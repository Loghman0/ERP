/* ================================================================== */
/* ================ GLOBAL ERROR HANDLING (app-wide) ================ */
/* ================================================================== */
/* Previously there was no window.onerror / unhandledrejection handler
   anywhere in the app — an uncaught error in any view's render function
   (a null-dereference on a Firebase snapshot mid-load, a third-party
   library throwing, etc) would fail completely silently: no toast, no
   console-visible-to-the-user feedback, just a UI that stopped
   responding with no indication why. This module is the app-wide
   backstop for that: it doesn't replace per-function try/catch (still
   the right tool for expected failure points like a specific Firebase
   write), it's specifically for the *unexpected* case that would
   otherwise vanish into the void.

   Loaded as early as possible in index.html (right after utils.js, so
   $/toast are available) — see that file's <script> order. */
(function () {
  const RATE_LIMIT_MS = 4000; // don't spam a toast per error if one keeps re-firing
  let lastToastAt = 0;
  let errorCount = 0;

  function safeToast(msg) {
    const now = Date.now();
    if (now - lastToastAt < RATE_LIMIT_MS) return;
    lastToastAt = now;
    try {
      if (typeof toast === 'function' && document.getElementById('toastContainer')) {
        toast(msg, 'error');
      }
    } catch (_) {
      // toast() itself is unavailable this early or already broken —
      // fall through silently rather than risk a recursive error loop.
    }
  }

  function safeAudit(action, details) {
    try {
      if (typeof logAudit === 'function' && window.db && window.state?.user) {
        // logAudit already swallows its own failures (see js/utils.js) —
        // safe to fire-and-forget here too.
        logAudit(action, 'client_error', '', details).catch(() => { });
      }
    } catch (_) { /* db/state not initialized yet — nothing to log to */ }
  }

  window.addEventListener('error', (event) => {
    errorCount++;
    const msg = event?.error?.message || event?.message || 'Naməlum xəta';
    console.error('[unhandled error]', event?.error || event);
    safeToast('Gözlənilməz xəta baş verdi. Səhifəni yeniləməyi (F5) sınayın.');
    safeAudit('js_error', `${msg} @ ${event?.filename || '?'}:${event?.lineno || '?'}`.slice(0, 300));
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorCount++;
    const reason = event?.reason;
    const msg = (reason && (reason.message || String(reason))) || 'Naməlum promise xətası';
    console.error('[unhandled promise rejection]', reason);
    safeToast('Gözlənilməz xəta baş verdi. Səhifəni yeniləməyi (F5) sınayın.');
    safeAudit('js_unhandled_rejection', String(msg).slice(0, 300));
  });

  // Exposed for anyone debugging a report of "the app broke" — lets you
  // ask "how many uncaught errors has this session seen?" from the
  // console without needing to have had devtools open when it happened.
  window.__meramErrorCount = () => errorCount;
})();
