/* ================================================================== */
/* ============ IDLE SESSION TIMEOUT (shared-desk protection) ======= */
/* ================================================================== */
/* Signs the user out after a period of no mouse/keyboard/touch activity.
   Protects shared reception-desk computers where a logged-in admin or
   manager session could otherwise stay open indefinitely.

   Behavior:
   - Any of: mousemove, mousedown, keydown, scroll, touchstart resets
     the idle timer.
   - After (idleTimeoutMinutes - 1) minutes of inactivity, a 60-second
     warning modal appears with a live countdown and a "Stay logged in"
     button.
   - If no activity is seen before the countdown reaches 0, the user is
     signed out via the normal logout() path (which also writes the
     usual audit 'logout' entry).
   - Disabled entirely when MERAM_CONFIG.idleTimeoutMinutes is 0/falsy,
     or while the login screen is showing (no session to protect yet). */

const IDLE_TIMEOUT_MIN = Number(window.MERAM_CONFIG?.idleTimeoutMinutes);
const IDLE_WARNING_SECONDS = 60;

let _idleTimer = null;
let _warnTimer = null;
let _countdownInterval = null;
let _idleModalEl = null;

function _ensureIdleModal() {
  if (_idleModalEl) return _idleModalEl;
  const el = document.createElement('div');
  el.id = 'idleTimeoutModal';
  el.className = 'modal-bg';
  el.style.zIndex = '300'; // above confirmModal (200) — idle takes priority
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'idleTimeoutTitle');
  el.setAttribute('aria-describedby', 'idleTimeoutDesc');
  el.innerHTML = `
    <div class="overlay-surface rounded-[28px] p-8 max-w-sm w-full shadow-2xl text-center">
      <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-xl"
        style="background:var(--gold-50,#fffbeb);border:1px solid var(--gold-100,#fde68a);color:var(--gold-600,#b45309);">
        <i class="fa-solid fa-hourglass-half"></i>
      </div>
      <h3 id="idleTimeoutTitle" class="font-head text-lg font-bold mb-2" style="color:var(--text-strong);">Sessiya bitmək üzrədir</h3>
      <p id="idleTimeoutDesc" class="text-xs mb-7" style="color:var(--text-muted);">
        Fəaliyyətsizlik səbəbindən <span id="idleCountdownVal">60</span> saniyə sonra sistemdən çıxacaqsınız.
      </p>
      <div class="flex gap-3">
        <button id="idleStayBtn" class="flex-1 btn-primary py-3">Davam et</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#idleStayBtn').addEventListener('click', _dismissIdleWarning);
  // Escape should behave the same as clicking "Davam et" here — not
  // just hide the modal (openModal/closeModal's default Escape
  // behavior), because merely closing it would leave the countdown
  // interval still running in the background and log the user out a
  // few seconds later anyway, with no visible warning left on screen
  // to explain why. Intercepting Escape at the capture phase, before
  // the generic modal keydown handler sees it, ensures the full
  // dismiss path (clearing the interval + resetting the idle timer)
  // always runs together.
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      _dismissIdleWarning();
    }
  }, { capture: true });
  _idleModalEl = el;
  return el;
}

function _showIdleWarning() {
  const el = _ensureIdleModal();
  openModal(el.id); // uses the shared modal a11y behavior (focus trap, aria-modal, Escape) — see js/utils.js
  let remaining = IDLE_WARNING_SECONDS;
  el.querySelector('#idleCountdownVal').textContent = remaining;
  clearInterval(_countdownInterval);
  _countdownInterval = setInterval(() => {
    remaining -= 1;
    const span = el.querySelector('#idleCountdownVal');
    if (span) span.textContent = Math.max(0, remaining);
    if (remaining <= 0) {
      clearInterval(_countdownInterval);
      _forceIdleLogout();
    }
  }, 1000);
}

function _dismissIdleWarning() {
  if (_idleModalEl) closeModal(_idleModalEl.id);
  clearInterval(_countdownInterval);
  _resetIdleTimers();
}

async function _forceIdleLogout() {
  if (_idleModalEl) closeModal(_idleModalEl.id);
  clearInterval(_countdownInterval);
  _clearIdleTimers();
  try { await logAudit('idle_logout', 'auth', state.user?.uid || '', 'auto sign-out after inactivity'); } catch (_) { }
  try { await auth.signOut(); } catch (_) { }
  location.reload();
}

function _clearIdleTimers() {
  clearTimeout(_idleTimer);
  clearTimeout(_warnTimer);
}

function _resetIdleTimers() {
  if (!IDLE_TIMEOUT_MIN || IDLE_TIMEOUT_MIN <= 0) return;
  if (!state.user) return; // no active session to protect
  _clearIdleTimers();
  const warnAtMs = Math.max(0, IDLE_TIMEOUT_MIN * 60 * 1000 - IDLE_WARNING_SECONDS * 1000);
  _warnTimer = setTimeout(_showIdleWarning, warnAtMs);
}

function initIdleTimeout() {
  if (!IDLE_TIMEOUT_MIN || IDLE_TIMEOUT_MIN <= 0) return;
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
  activityEvents.forEach((evt) => {
    document.addEventListener(evt, () => {
      // Only reset from real activity, not while the warning modal itself
      // is up — that's dismissed explicitly via the "Stay logged in" button
      // so a stray mouse-jiggle from a screensaver etc. doesn't mask it.
      if (_idleModalEl && _idleModalEl.classList.contains('active')) return;
      _resetIdleTimers();
    }, { passive: true });
  });
  _resetIdleTimers();
}

// Stop timers on logout so a lingering setTimeout doesn't fire against a
// signed-out session and throw.
const _origLogout = typeof logout === 'function' ? logout : null;
if (_origLogout) {
  window.logout = async function patchedLogout() {
    _clearIdleTimers();
    clearInterval(_countdownInterval);
    return _origLogout();
  };
}
