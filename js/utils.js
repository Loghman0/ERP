/* ============ HELPERS ============ */
const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number(n) || 0).toLocaleString('az-AZ', { maximumFractionDigits: 0 }) + " ₼";
// Use Azerbaijan local time (UTC+4) so date is correct around midnight.
const today = () => { const d = new Date(Date.now() + 4 * 60 * 60 * 1000); return d.toISOString().slice(0, 10); };
const monthKey = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, '0'); };
const classLabel = (c) => CLASS_LABEL[c] || (c ? c + "-ci sinif" : "-");

// Delays calling `fn` until `wait` ms have passed since the last call —
// used on search/filter inputs (students, teachers, users) so a full
// table re-render doesn't fire on every single keystroke. Each named
// debounced function keeps its own independent timer (keyed by `key`),
// so e.g. the student search and teacher search don't interfere with
// each other even though both could call `debounce()` with the same
// generic wait time.
const _debounceTimers = {};
function debounce(key, fn, wait = 200) {
  return function debounced(...args) {
    clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(() => fn.apply(this, args), wait);
  };
}

function toast(msg, type = "success") {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : type === 'error' ? 'circle-xmark' : 'circle-info'} mr-2"></i>${msg}`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}

/* ================================================================== */
/* ================ MODAL ACCESSIBILITY (openModal/closeModal) ====== */
/* ================================================================== */
/* Centralized here so every modal in the app — the ~8 static ones in
   index.html, the dynamically-built ones in views/users.js and
   views/schedule.js, and js/idle-timeout.js's warning modal — gets the
   same accessible behavior automatically, without every call site
   needing to remember to add it by hand:
   - role="dialog" + aria-modal="true" so screen readers announce it as
     a dialog rather than silently reading the whole page behind it.
   - Focus moves into the modal on open (first focusable element, or
     the modal container itself as a fallback) and returns to whatever
     had focus before the modal opened once it closes — previously
     focus stayed wherever it was, so a keyboard user opening a modal
     had no indication anything had changed.
   - Tab/Shift+Tab is trapped inside the modal while it's open, so
     keyboard users can't silently tab out into the page behind it.
   - Escape closes the modal, matching standard dialog conventions.
   None of this requires any change to the modal HTML itself — it reads
   whatever's already in the DOM under the given id. */
const _focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
let _lastFocusedBeforeModal = null;

function _trapModalTab(e, modalEl) {
  if (e.key !== 'Tab') return;
  const focusable = Array.from(modalEl.querySelectorAll(_focusableSelector)).filter((el) => el.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function _onModalKeydown(e) {
  const modalEl = e.currentTarget;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal(modalEl.id);
  } else {
    _trapModalTab(e, modalEl);
  }
}

function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('active');
  el.setAttribute('role', el.getAttribute('role') || 'dialog');
  el.setAttribute('aria-modal', 'true');
  _lastFocusedBeforeModal = document.activeElement;
  el.addEventListener('keydown', _onModalKeydown);
  // Move focus in on the next frame — the modal's own 'active' class
  // (and any animation it triggers) needs to apply first, or focusing
  // an element that's still display:none in some browsers silently
  // no-ops.
  requestAnimationFrame(() => {
    const focusable = el.querySelector(_focusableSelector);
    (focusable || el).focus?.();
  });
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('active');
  el.removeAttribute('aria-modal');
  el.removeEventListener('keydown', _onModalKeydown);
  // Return focus to whatever opened the modal (a button, a table row
  // action, etc) so a keyboard user isn't dropped back at the top of
  // the page after closing.
  if (_lastFocusedBeforeModal && typeof _lastFocusedBeforeModal.focus === 'function') {
    _lastFocusedBeforeModal.focus();
  }
  _lastFocusedBeforeModal = null;
}

function confirmAction(title, text, onOk) {
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  const btn = $('confirmOkBtn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => { closeModal('confirmModal'); onOk(); });
  openModal('confirmModal');
}

function activeBranch() {
  if (isAdminRole()) return state.branchFilter;
  return state.profile.branch;
}

function filterByBranch(obj) {
  const b = activeBranch();
  return Object.entries(obj || {}).filter(([_, v]) => b === 'all' ? true : v.branch === b);
}

function canEdit(record) {
  if (isAdminRole()) return true;
  return record.branch === state.profile.branch;
}

function isOverdue(dateStr, status) {
  if (status === 'paid' || !dateStr) return false;
  return new Date(dateStr) < new Date(today());
}

function toggleSidebar(open) {
  $('sidebar').classList.toggle('open', open);
  $('sidebarOverlay').classList.toggle('active', open);
}

// Minimum password policy shared by self-service change (Settings) and
// admin-created accounts (Users): at least 8 characters, at least one
// letter, at least one digit. Deliberately not requiring symbols/mixed
// case — NIST 800-63B guidance favors length over composition rules,
// and stricter composition rules mostly push people toward predictable
// substitutions (e.g. "Passw0rd!") without much real security gain.
function isStrongPassword(pw) {
  const s = String(pw || '');
  return s.length >= 8 && /[A-Za-zƏəĞğİıÖöŞşÜüÇç]/.test(s) && /[0-9]/.test(s);
}

// Shared HTML-escaping helper. Declared here (loaded first) so every view
// can rely on it; previously only defined inside views/schedule.js, which
// happened to work because script tags share one global scope by the time
// any view actually renders, but that made the dependency easy to miss.
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Consistent "no access" panel for gated views (AI modules, Users, etc).
// Previously called in 4+ places but never defined anywhere, which threw a
// ReferenceError and blank-screened the view for any unauthorized visitor
// instead of explaining why.
function aiNoAccessHTML(msg) {
  return `
    <div class="empty-state" style="padding:72px 24px;">
      <i class="fa-solid fa-lock" style="color:var(--text-faint);"></i>
      <p style="color:var(--text-strong);font-size:14px;">${escapeHtml(msg || 'Bu bölməyə icazəniz yoxdur')}</p>
      <p style="color:var(--text-muted);font-weight:500;font-size:12px;margin-top:4px;">Lazım olduqda admin ilə əlaqə saxlayın</p>
    </div>`;
}

function emptyStateHTML(icon, msg) {
  return `<div class="empty-state"><i class="fa-solid ${icon || 'fa-inbox'}"></i><p>${escapeHtml(msg || 'Məlumat tapılmadı')}</p></div>`;
}

/* ===== Audit log ===== */
async function logAudit(action, entity, entityId, details) {
  try {
    await db.ref('audit').push({
      action, entity, entityId, details: details || '',
      userId: state.user?.uid || null,
      userEmail: state.profile?.email || (state.user && state.user.email) || '',
      role: state.profile?.role || null,
      branch: state.profile?.branch || null,
      ts: Date.now()
    });
  } catch (err) { console.warn('Audit write failed:', err); }
}

