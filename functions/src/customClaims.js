const { onValueWritten } = require("firebase-functions/v2/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { requireAdmin } = require("./authHelpers");

/**
 * Custom-claims sync — closes finding #6 from SECURITY_RULES_README.md
 * ("Custom claims vs. DB-stored role"): database.rules.json used to
 * trust users/{uid}/role and users/{uid}/branch directly out of the
 * database for EVERY authorization decision in the app. That's solid
 * as long as the rules governing who can write those two fields are
 * airtight, but it means the database itself sits in the trust chain —
 * one rules bug, or one already-compromised admin account, is a single
 * step away from a self-granted privilege escalation with no second
 * layer of defense.
 *
 * This trigger fires whenever users/{uid}/role or users/{uid}/branch
 * changes, and mirrors the new values onto the user's Firebase Auth
 * custom claims (auth.token.role / auth.token.branch). database.rules.json
 * now checks auth.token.role/branch instead of the DB lookup for every
 * *authorization* decision — removing the database from that trust
 * chain entirely; a rules bug can no longer alone grant a privilege
 * escalation, because the claim itself is only ever set here, by admin
 * SDK code, gated by requireAdmin()/the DB rule that already restricts
 * who can write users/{uid}/role in the first place.
 *
 * WHY "active" IS DELIBERATELY *NOT* PART OF THIS MIGRATION:
 * Custom claims only take effect in a client's ID token after that
 * token is refreshed — which can lag up to an hour by default, or
 * requires an explicit getIdToken(true) call (see js/auth.js). role and
 * branch change rarely and a short propagation delay after a role
 * change is an acceptable trade-off (the client also force-refreshes
 * its token right after a change it's told about — see below). But
 * "active" specifically needs to take effect INSTANTLY on deactivation
 * — that's the whole point of setUserActive() in userAdmin.js. Moving
 * "active" into a claim would reintroduce a stale-token window where a
 * just-deactivated user keeps working until their token happens to
 * refresh. So database.rules.json keeps checking
 * root.child('users').child(auth.uid).child('active') from the DB
 * directly, same as before — only role/branch moved to claims.
 */
const syncUserClaims = onValueWritten("users/{uid}/role", async (event) => {
  await syncClaimsForUid(event.params.uid);
});

const syncBranchClaims = onValueWritten("users/{uid}/branch", async (event) => {
  await syncClaimsForUid(event.params.uid);
});

async function syncClaimsForUid(uid) {
  const auth = getAuth();
  const db = getDatabase();
  const snap = await db.ref(`users/${uid}`).get();
  const profile = snap.val();

  if (!profile) {
    // User record was deleted (or never existed) — clear any stale
    // claims rather than leaving old role/branch claims attached to a
    // uid with no corresponding profile. deleteUserAccount() already
    // deletes the Auth user entirely in the normal flow, so this path
    // mainly guards against a manual DB deletion done outside the app.
    try {
      await auth.setCustomUserClaims(uid, { role: null, branch: null });
    } catch (err) {
      // Auth user may already be gone too (normal delete flow) — fine.
      if (err.code !== "auth/user-not-found") throw err;
    }
    return;
  }

  await auth.setCustomUserClaims(uid, {
    role: profile.role || null,
    branch: profile.branch || null,
  });
}

/**
 * Callable the client invokes right after a role/branch change it needs
 * reflected as soon as possible — e.g. an admin just edited a user's
 * role and wants that user's NEXT permission check to see it without
 * waiting for their token's natural refresh window. Also useful as a
 * manual fix-up if the trigger above ever misses an event (Cloud
 * Functions triggers are at-least-once, not guaranteed-immediate).
 *
 * Any authenticated user can call this for THEIR OWN uid; only an admin
 * can force a resync for someone else's uid.
 */
const resyncMyClaims = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Bu əməliyyat üçün daxil olmalısınız.");
  }
  const targetUid = request.data?.uid || request.auth.uid;
  if (targetUid !== request.auth.uid) {
    await requireAdmin(request); // resyncing someone ELSE's claims requires admin
  }
  await syncClaimsForUid(targetUid);
  return { ok: true };
});

module.exports = { syncUserClaims, syncBranchClaims, resyncMyClaims, syncClaimsForUid };
