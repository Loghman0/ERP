/* ================================================================== */
/* ================ PWA: SERVICE WORKER REGISTRATION ================ */
/* ================================================================== */
/* Kept as its own tiny external file rather than an inline <script>
   block in index.html specifically so it can run under this app's
   Content-Security-Policy (script-src 'self' ...) without needing
   'unsafe-inline' — an inline block would otherwise be silently
   blocked by that same CSP.

   Registered after `load` so a slow/failed service worker registration
   never delays first paint or first interaction. See sw.js's header
   comment for exactly what it does and does not cache. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker registration failed (offline app-shell support unavailable this session):', err);
    });
  });
}
