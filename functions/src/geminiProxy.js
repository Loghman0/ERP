const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getDatabase } = require("firebase-admin/database");
const { loadCallerProfile, isAdminRole } = require("./authHelpers");

// Set with: firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_PROMPT_CHARS = 20000; // guards against pathologically large client payloads
const DEFAULT_DAILY_TOTAL = 500;

function todayKey() {
  // Azerbaijan is UTC+4 with no DST. Compute the local calendar date
  // directly instead of using server-local time (which on Cloud
  // Functions is UTC), fixing the "midnight rollover" bug (#26) for the
  // one place quota dates matter most: the boundary that actually gates
  // requests.
  const AZ_OFFSET_MS = 4 * 60 * 60 * 1000;
  const local = new Date(Date.now() + AZ_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

/**
 * Atomically checks and increments today's AI usage counter for a branch.
 * Returns { ok, remaining } — ok is false if the branch's daily quota is
 * already used up. Uses a DB transaction, same mechanism the old
 * client-side code used, but now it's the only path capable of writing
 * this value (writes to aiQuota/usage are still allowed by the rules for
 * backward compatibility with any older screens, but the deployed
 * database.rules.json can be tightened to admin-and-functions-only once
 * this proxy fully replaces the direct client calls).
 */
async function checkAndIncrementQuota(branch) {
  const db = getDatabase();
  const configSnap = await db.ref("aiQuota/config/dailyTotal").get();
  const totalRaw = parseInt(configSnap.val(), 10);
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : DEFAULT_DAILY_TOTAL;
  const perBranch = Math.floor(total / 2);
  const dateKey = todayKey();
  const ref = db.ref(`aiQuota/usage/${dateKey}/${branch}`);

  const result = await ref.transaction((current) => {
    const next = (current || 0) + 1;
    if (next > perBranch) return; // abort — over quota
    return next;
  });

  return { ok: result.committed, perBranch, dateKey };
}

/** Rolls back a successful reservation if the Gemini call itself fails,
 *  so a 429/500 from Gemini doesn't silently cost the branch a request
 *  (closes finding #25). */
async function rollbackQuota(branch, dateKey) {
  const db = getDatabase();
  const ref = db.ref(`aiQuota/usage/${dateKey}/${branch}`);
  await ref.transaction((current) => {
    if (!current) return 0;
    return current - 1;
  });
}

const geminiProxy = onCall(
  { secrets: [GEMINI_API_KEY], cors: true, timeoutSeconds: 60 },
  async (request) => {
    const { profile } = await loadCallerProfile(request);

    const hasAiPerm =
      isAdminRole(profile.role) ||
      // Mirrors the client-side RBAC catalogue (ai.view / ai.chat granted
      // to manager/reception/teacher/etc — see js/permissions.js). Kept
      // as an explicit allow-list here rather than trusting a client-sent
      // permission flag, since request.data is caller-controlled.
      ["manager", "reception", "teacher", "accountant", "hr"].includes(profile.role);
    if (!hasAiPerm) {
      throw new HttpsError("permission-denied", "AI istifadəsinə icazəniz yoxdur.");
    }

    const { prompt, systemInstruction } = request.data || {};
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new HttpsError("invalid-argument", "Prompt boş ola bilməz.");
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new HttpsError("invalid-argument", "Prompt həddindən artıq uzundur.");
    }

    // Admin (branch === 'all') is not quota-limited per-branch, matching
    // the previous client behavior (quotaBranch was null for admins).
    const quotaBranch = profile.branch && profile.branch !== "all" ? profile.branch : null;
    let reservation = null;
    if (quotaBranch) {
      reservation = await checkAndIncrementQuota(quotaBranch);
      if (!reservation.ok) {
        throw new HttpsError(
          "resource-exhausted",
          "Bu filialın günlük AI limiti doldu."
        );
      }
    }

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    };
    if (typeof systemInstruction === "string" && systemInstruction.trim()) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    let res;
    try {
      res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY.value()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (reservation) await rollbackQuota(quotaBranch, reservation.dateKey);
      throw new HttpsError("unavailable", "Gemini-yə qoşulmaq mümkün olmadı.");
    }

    if (!res.ok) {
      if (reservation) await rollbackQuota(quotaBranch, reservation.dateKey);
      const status = res.status;
      if (status === 429) {
        throw new HttpsError("resource-exhausted", "Gemini: çox sorğu göndərilib. Bir az gözləyin.");
      }
      if (status === 401 || status === 403) {
        throw new HttpsError("internal", "Gemini API açarı ilə bağlı xəta.");
      }
      throw new HttpsError("internal", `Gemini xətası (${status}).`);
    }

    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    if (!text) {
      if (reservation) await rollbackQuota(quotaBranch, reservation.dateKey);
      throw new HttpsError("internal", "Gemini-dən boş cavab gəldi.");
    }

    // Audit, server-side — this entry can be trusted because it wasn't
    // constructed by the client (closes part of finding #34 for AI calls
    // specifically; general audit-forgery risk for other actions remains
    // until those writes also move server-side or custom claims land).
    try {
      await getDatabase().ref("audit").push({
        action: "ai_call",
        entity: "gemini",
        entityId: "",
        details: `prompt:${prompt.length}ch · branch:${quotaBranch || "admin"}`,
        userId: request.auth.uid,
        userEmail: profile.email || "",
        role: profile.role || null,
        branch: profile.branch || null,
        ts: Date.now(),
      });
    } catch (_) {
      // Non-fatal — don't fail the AI response just because audit logging failed.
    }

    return { text };
  }
);

module.exports = { geminiProxy };
