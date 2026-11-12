/* ============ BRANCH-SCOPED DATA LISTENERS ============ */
/* Admins/super_admins can switch state.branchFilter live between 'all',
   'sheher', and 'goynuk' (see the branch switcher in bootApp() below,
   hidden for everyone else), so they genuinely need every branch's
   data available client-side to switch between instantly with no extra
   round trip.

   Every other role is PERMANENTLY pinned to state.profile.branch — it
   never changes for the lifetime of their session (activeBranch() in
   js/utils.js returns state.profile.branch directly for non-admins, and
   the branch switcher UI is hidden for them). For those roles, syncing
   every OTHER branch's students/teachers/income/expenses into memory —
   which the old unconditional `db.ref('students').on('value', ...)` did
   for literally everyone — was pure waste: extra payload on every
   login, extra memory held for records that filterByBranch() would
   immediately filter back out again on every single render anyway.

   scopedCollectionListener() uses Firebase's own indexed query
   (orderByChild('branch').equalTo(...) — see database.rules.json's
   ".indexOn": ["branch"] entries, required for this to be efficient
   server-side rather than a full collection scan) so a branch-locked
   role only ever receives, and only ever holds in memory, their own
   branch's records in the first place. Admins keep the original
   unscoped .on('value') query, since 'all' or a live-switchable branch
   filter both need the same full dataset regardless of which query
   style is used — activeBranch() decides which one applies per call. */
function scopedCollectionListener(path, onData) {
  const branch = activeBranch();
  const isScoped = !isAdminRole() && branch && branch !== 'all';
  const ref = isScoped
    ? db.ref(path).orderByChild('branch').equalTo(branch)
    : db.ref(path);
  ref.on('value', (s) => onData(s.val() || {}));
}
// KNOWN LIMITATION, not new: state.profile (and therefore the branch a
// non-admin's listeners are scoped to) is set once at login and never
// live-refreshed — see js/auth.js's onAuthStateChanged handler. If an
// admin changes a currently-logged-in user's branch mid-session, that
// user keeps seeing their OLD branch's data until they reload/re-login.
// This predates the query-scoping above: the old unconditional
// `.on('value')` synced every branch regardless, so the same staleness
// already existed one layer up, in the client-side filterByBranch()
// filtering against a stale state.profile.branch. Not introduced here,
// just worth naming explicitly now that it also governs which data is
// actually FETCHED, not only which data is displayed.

/* ============ BOOT ============ */
function bootApp() {
  $('loginScreen').classList.add('hidden');
  $('app').classList.remove('hidden');

  $('userEmail').textContent = state.profile.name || state.profile.email;
  $('userAvatar').textContent = (state.profile.name || state.profile.email || 'U').charAt(0).toUpperCase();
  const roleLbl = ROLE_LABEL[state.profile.role] || (state.profile.role || '').toUpperCase();
  $('userRoleBadge').textContent = roleLbl + (state.profile.role !== 'admin' ? ' · ' + (BRANCH_LABEL[state.profile.branch] || '') : '');

  if (isAdminRole()) {
    state.branchFilter = 'all';
  } else {
    $('branchSwitcher').classList.add('hidden');
    state.branchFilter = state.profile.branch;
  }

  // SECURITY: apply per-role permission gating on nav + buttons
  applyPermissions();
  // AI chat FAB only when role has AI perm
  if (can('aiChat') && typeof initAIChatFAB === 'function') initAIChatFAB();
  // Auto-logout after inactivity (shared front-desk computers) — no-op
  // if MERAM_CONFIG.idleTimeoutMinutes is 0/unset.
  if (typeof initIdleTimeout === 'function') initIdleTimeout();

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
      if (window.innerWidth < 1024) toggleSidebar(false);
    });
  });

  // state.branchFilter is set above (before these listeners attach), so
  // scopedCollectionListener's activeBranch() check sees the right value
  // from the very first subscription — a non-admin's students/teachers/
  // income/expenses listeners are scoped from the start, not just after
  // some later re-render.
  scopedCollectionListener('students', (v) => { state.students = v; renderCurrent(); });
  scopedCollectionListener('teachers', (v) => { state.teachers = v; renderCurrent(); });
  scopedCollectionListener('finance/income', (v) => { state.income = v; renderCurrent(); });
  scopedCollectionListener('finance/expenses', (v) => { state.expenses = v; renderCurrent(); });
  db.ref('examResults').on('value', s => { state.examResults = s.val() || {}; if (state.profileTab === 'exams' && state.currentProfileId) renderProfileExams(); });
  db.ref('settings/subjects').on('value', s => {
    if (s.val() && Array.isArray(s.val()) && s.val().length) state.subjects = s.val();
    renderCurrent();
  });
  db.ref('settings/summerSubjects').on('value', s => {
    if (s.val() && Array.isArray(s.val()) && s.val().length) state.summerSubjects = s.val();
    renderCurrent();
  });
  db.ref('settings/branches').on('value', s => {
    state.branches = s.val() || {};
    renderCurrent();
  });
  db.ref('attendance').on('value', s => { state.attendance = s.val() || {}; if (state.currentView === 'attendance') renderAttendance(); });
  db.ref('schedule').on('value', s => { state.schedule = s.val() || {}; if (state.currentView === 'schedule') renderSchedule(); });
  if (isAdminRole() || can('users.view')) {
    db.ref('users').on('value', s => {
      state.users = s.val() || {};
      if (state.currentView === 'settings') renderSettings();
      if (state.currentView === 'users' && typeof renderUsers === 'function') renderUsers();
    });
  }
  if (isAdminRole()) {
    db.ref('audit').limitToLast(200).on('value', s => { state.audit = s.val() || {}; if (state.currentView === 'settings') renderSettings(); });
  }

  switchView('dashboard');
}

function onBranchFilterChange() {
  state.branchFilter = $('branchFilter').value;
  renderCurrent();
}

function renderCurrent() { switchView(state.currentView, true); }

function applyPermissions() {
  // Hide nav items by data-perm
  document.querySelectorAll('[data-perm]').forEach(el => {
    const p = el.getAttribute('data-perm');
    el.style.display = can(p) ? '' : 'none';
  });
  // Legacy: data-admin-only kept for back-compat (admin-strict elements)
  document.querySelectorAll('[data-admin-only="1"]:not([data-perm])').forEach(el => {
    el.style.display = state.profile?.role === 'admin' ? '' : 'none';
  });
}

const ADMIN_ONLY_VIEWS = ['ai-finance', 'ai-students', 'ai-forecast'];
function switchView(view, keepActive = false) {
  // SECURITY: per-permission view guard
  const needed = VIEW_PERMS[view];
  if (needed && !can(needed)) {
    toast('Bu bölməyə icazəniz yoxdur', 'error');
    view = 'dashboard';
  }
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('view-enter', 'view-exit');
  });
  const el = $('view-' + view);
  el.classList.remove('hidden');
  // Yumşaq keçid: reflow + enter animasiyası
  void el.offsetWidth;
  el.classList.add('view-enter');
  el.addEventListener('animationend', () => el.classList.remove('view-enter'), { once: true });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));

  const titles = {
    dashboard: ["Dashboard", "Ümumi Baxış"],
    students: ["Şagirdlər", "İdarəetmə"],
    attendance: ["Davamiyyət", "Şagird iştirakı"],
    schedule: ["Cədvəl", "Həftəlik dərs planı"],
    teachers: ["Kadrlar", "İşçi heyəti"],
    finance: ["Maliyyə & Büdcə", "Gəlir / Xərc / Mənfəət"],
    info: ["Məlumat", "Sistem bələdçisi"],
    settings: ["Parametrlər", "Sistem"],
    users: ["İstifadəçilər", "İstifadəçi idarəetməsi"],
    'ai-finance': ["AI Maliyyə Analizi", "Gemini hesabatı"],
    'ai-students': ["AI Şagird Hesabatı", "Avtomatik analiz"],
    'ai-forecast': ["AI Proqnoz", "Növbəti ay"],
  };
  if (titles[view]) {
    $('viewTitle').textContent = titles[view][0];
    $('viewSubtitle').textContent = titles[view][1];
  }

  if (isAdminRole()) {
    if (view === 'dashboard' || view === 'info' || view === 'schedule' || view.startsWith('ai-')) {
      $('branchSwitcher').classList.add('hidden');
    } else {
      $('branchSwitcher').classList.remove('hidden');
    }
  }

  if (view === 'dashboard') renderDashboard();
  if (view === 'students') renderStudents();
  if (view === 'attendance') renderAttendance();
  if (view === 'schedule') renderSchedule();
  if (view === 'teachers') renderTeachers();
  if (view === 'finance') renderFinance();
  if (view === 'info') renderInfo();
  if (view === 'settings') renderSettings();
  if (view === 'users' && typeof renderUsers === 'function') renderUsers();
  if (view === 'ai-finance') renderAIFinance();
  if (view === 'ai-students') renderAIStudents();
  if (view === 'ai-forecast') renderAIForecast();
}

