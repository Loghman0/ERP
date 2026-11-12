/* ================================================================== */
/* =================== GEMINI AI INTEGRATION ======================== */
/* ================================================================== */
/* Calls Gemini through the deployed Cloud Function proxy
   (functions/src/geminiProxy.js) when it's available — that function
   holds the Gemini API key server-side (via a Secret Manager secret,
   never shipped to the browser) and enforces the daily quota with a
   real, atomic, server-side check instead of a client-trusted counter.

   FALLBACK: if functions/ hasn't been deployed for this project yet
   (firebase deploy --only functions, see firebase.json), the callable
   request fails and callGemini() falls back to the original direct
   browser → Gemini call using the key in js/config.js. That path is
   kept working intentionally so the AI features don't just break for
   anyone mid-migration, but it inherits every caveat the old
   implementation had:
   - The key is visible to anyone who opens dev tools, protected only
     by an HTTP referrer restriction set on the key itself in Google
     Cloud Console (Credentials → this key → Application restrictions).
   - That restriction stops someone embedding your key in their OWN
     web app, but does NOT stop a non-browser client with a spoofed
     Referer header from using the key directly.
   - The quota check in this fallback path is a client-side courtesy
     counter, not an enforced cap.
   Deploying functions/ removes all three caveats — see
   functions/src/geminiProxy.js and SECURITY_RULES_README.md. */
const GEMINI_CONFIG = (window.MERAM_CONFIG && window.MERAM_CONFIG.gemini) || {
  apiKey: '',
  model: 'gemini-3.6-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
};
const AI_CACHE = new Map();
const AI_CACHE_TTL = (GEMINI_CONFIG.cacheTTLMinutes || 10) * 60 * 1000;

// Cached across calls so a deployed-vs-not-deployed proxy is only
// detected once per page load rather than on every single AI call.
let _geminiProxyAvailable = null;

function _isFunctionsUnavailableErr(err) {
  return err?.code === 'functions/not-found' || err?.code === 'functions/internal' || err?.code === 'functions/unavailable';
}

async function _callGeminiViaProxy(prompt, systemInstruction) {
  const callable = fns.httpsCallable('geminiProxy');
  const res = await callable({ prompt, systemInstruction });
  const text = res?.data?.text || '';
  if (!text) throw new Error('Gemini-dən boş cavab gəldi.');
  return text;
}

async function _callGeminiDirect(prompt, systemInstruction, quotaBranch) {
  if (quotaBranch) {
    const okQ = await checkAndIncrementAIQuota(quotaBranch);
    if (!okQ) { toast('Bu filialın günlük AI limiti doldu', 'error'); throw new Error('AI günlük limit aşıldı'); }
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: GEMINI_CONFIG.temperature ?? 0.3,
      maxOutputTokens: GEMINI_CONFIG.maxOutputTokens || 2048,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const url = `${GEMINI_CONFIG.endpoint}?key=${GEMINI_CONFIG.apiKey}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error('Şəbəkə xətası: ' + (err.message || 'Gemini-yə qoşulmaq mümkün olmadı'));
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // A 429/500 here still costs the branch its quota increment above —
    // there's no server-side reservation/rollback in this fallback path.
    if (res.status === 429) throw new Error('Çox sorğu göndərilib (429). Bir az gözləyin və yenidən cəhd edin.');
    if (res.status === 401 || res.status === 403) throw new Error('API açar səhvdir və ya icazə yoxdur.');
    throw new Error(`Gemini xətası (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini-dən boş cavab gəldi.');
  return text;
}

async function callGemini(prompt, opts = {}) {
  const { cacheKey, systemInstruction } = opts;
  if (cacheKey && AI_CACHE.has(cacheKey)) {
    const e = AI_CACHE.get(cacheKey);
    if (Date.now() - e.ts < AI_CACHE_TTL) return e.data;
    AI_CACHE.delete(cacheKey);
  }
  if (!can('ai') && !can('aiChat')) { toast('AI istifadəsinə icazəniz yoxdur', 'error'); throw new Error('AI icazəsi yoxdur'); }
  const quotaBranch = state.profile?.branch && state.profile.branch !== 'all' ? state.profile.branch : null;

  let text;
  let usedProxy = false;
  if (_geminiProxyAvailable !== false) {
    try {
      text = await _callGeminiViaProxy(prompt, systemInstruction);
      usedProxy = true;
      _geminiProxyAvailable = true;
    } catch (err) {
      if (_isFunctionsUnavailableErr(err)) {
        // Proxy not deployed for this project — remember that for the
        // rest of the session and fall through to the direct call below.
        _geminiProxyAvailable = false;
      } else {
        // Proxy IS deployed but rejected this specific request (bad
        // permission, quota exhausted, Gemini error) — surface that
        // directly rather than silently falling back and double-billing
        // quota against the client-side counter too.
        throw err;
      }
    }
  }
  if (!usedProxy) {
    text = await _callGeminiDirect(prompt, systemInstruction, quotaBranch);
  }

  if (cacheKey) AI_CACHE.set(cacheKey, { ts: Date.now(), data: text });
  // The proxy path already writes its own server-side audit entry
  // (functions/src/geminiProxy.js) — only log here for the direct
  // fallback path, to avoid a duplicate entry for the same call.
  if (!usedProxy) {
    logAudit('ai_call', 'gemini', cacheKey || '', `prompt:${prompt.length}ch · branch:${quotaBranch || 'admin'} · direct-fallback`);
  }
  return text;
}

/* ====== AI QUOTA (50/50 per branch per day) ====== */
async function getAIDailyTotal() {
  try {
    const snap = await db.ref('aiQuota/config/dailyTotal').get();
    const v = parseInt(snap.val(), 10);
    return Number.isFinite(v) && v > 0 ? v : 500; // default 500/day
  } catch (_) { return 500; }
}
async function checkAndIncrementAIQuota(branch) {
  const total = await getAIDailyTotal();
  const perBranch = Math.floor(total / 2);
  const dateKey = today();
  const ref = db.ref(`aiQuota/usage/${dateKey}/${branch}`);
  const tx = await ref.transaction(curr => {
    const c = (curr || 0) + 1;
    if (c > perBranch) return; // abort
    return c;
  });
  return tx.committed;
}
async function readAIUsageToday() {
  const dateKey = today();
  const snap = await db.ref(`aiQuota/usage/${dateKey}`).get();
  const v = snap.val() || {};
  const total = await getAIDailyTotal();
  const perBranch = Math.floor(total / 2);
  return {
    date: dateKey, total, perBranch,
    sheher: v.sheher || 0, goynuk: v.goynuk || 0,
  };
}
async function resetAIUsageToday() {
  const dateKey = today();
  await db.ref(`aiQuota/usage/${dateKey}`).remove();
  await logAudit('update', 'ai_quota', dateKey, 'günlük sayğac sıfırlandı');
  toast('Bugünkü AI sayğacı sıfırlandı');
  if (state.currentView === 'settings') renderSettings();
}
async function setAIDailyTotal(n) {
  const v = Math.max(2, parseInt(n, 10) || 0);
  await db.ref('aiQuota/config/dailyTotal').set(v);
  await logAudit('update', 'ai_quota_config', '', `dailyTotal=${v}`);
  toast('AI günlük limiti yeniləndi');
  if (state.currentView === 'settings') renderSettings();
}

// Simple markdown renderer (headings, bold, italic, lists, line breaks)
function renderMD(md) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let h = esc(md);
  h = h.replace(/^### (.+)$/gm, '<h3 class="text-base font-black text-emerald-300 mt-3 mb-1">$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2 class="text-lg font-black text-purple-300 mt-4 mb-2">$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1 class="text-xl font-black text-white mt-4 mb-2">$1</h1>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 text-xs">$1</code>');
  // bullet lists
  h = h.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => '<li class="ml-5 list-disc">' + l.replace(/^[-*]\s+/, '') + '</li>').join('');
    return '\n<ul class="space-y-1 my-2">' + items + '</ul>';
  });
  // numbered lists
  h = h.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => '<li class="ml-5 list-decimal">' + l.replace(/^\d+\.\s+/, '') + '</li>').join('');
    return '\n<ol class="space-y-1 my-2">' + items + '</ol>';
  });
  h = h.replace(/\n{2,}/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return '<div class="text-sm text-slate-200 leading-relaxed">' + h + '</div>';
}

