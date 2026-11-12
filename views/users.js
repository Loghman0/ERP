/**
 * Users Management View
 *
 * Renders a full user management UI inside #view-users.
 * Features: list with status/last-login/role/branch, create, edit,
 * activate/deactivate, reset password, delete.
 *
 * Depends on: state, db, RBAC, toast, confirmAction, openModal, closeModal, logAudit
 */

/* =========================================================
   RENDER MAIN VIEW
   ========================================================= */
function renderUsers() {
  if (!RBAC.can('users.view')) {
    document.getElementById('view-users').innerHTML = aiNoAccessHTML();
    return;
  }

  const users = state.users || {};
  const entries = Object.entries(users);

  document.getElementById('view-users').innerHTML = `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="eyebrow"><i class="fa-solid fa-users mr-2" style="color:var(--accent-text);"></i>${entries.length} istifadəçi</p>
        <div class="flex gap-2">
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style="color:var(--text-faint);"></i>
            <input id="userSearchInput" class="input-style py-2 pl-8 text-xs w-52" placeholder="Ad və ya email axtar..."
              oninput="debouncedFilterUsersTable()" />
          </div>
          ${RBAC.can('users.add') ? `
            <button onclick="openCreateUserModal()" class="btn-primary py-2 px-4 text-xs">
              <i class="fa-solid fa-user-plus mr-1"></i> Yeni İstifadəçi
            </button>` : ''}
        </div>
      </div>

      <!-- Table -->
      <div class="glass rounded-3xl overflow-hidden">
        <table class="w-full responsive-table" id="usersTable">
          <thead>
            <tr class="border-b" style="border-color:var(--border);">
              <th class="px-4 py-3 text-left eyebrow">Ad</th>
              <th class="px-4 py-3 text-left eyebrow hidden sm:table-cell">Email</th>
              <th class="px-4 py-3 text-left eyebrow">Rol</th>
              <th class="px-4 py-3 text-left eyebrow hidden md:table-cell">Filial</th>
              <th class="px-4 py-3 text-left eyebrow hidden lg:table-cell">Son Giriş</th>
              <th class="px-4 py-3 text-left eyebrow">Status</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            ${entries.length === 0
      ? `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-users-slash"></i><p>Heç bir istifadəçi tapılmadı</p></div></td></tr>`
      : entries.map(([uid, u]) => renderUserRow(uid, u)).join('')
    }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit User Modal -->
    <div id="usersModal" class="modal-bg" aria-labelledby="usersModalTitle">
      <div class="overlay-surface rounded-[28px] p-6 sm:p-8 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div class="flex items-center justify-between mb-6 pb-4 border-b" style="border-color:var(--border);">
          <h3 id="usersModalTitle" class="font-head text-lg font-bold" style="color:var(--text-strong);">Yeni İstifadəçi</h3>
          <button onclick="closeModal('usersModal')"
            class="text-xl w-9 h-9 flex items-center justify-center rounded-full transition"
            style="color:var(--text-muted);" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background=''">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form id="usersForm" class="space-y-4">
          <input type="hidden" id="uUid" />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="eyebrow mb-1.5 block">Ad</label>
              <input id="uFirstName" class="input-style" placeholder="Ad" />
            </div>
            <div>
              <label class="eyebrow mb-1.5 block">Soyad</label>
              <input id="uLastName" class="input-style" placeholder="Soyad" />
            </div>
          </div>
          <div>
            <label class="eyebrow mb-1.5 block">Email *</label>
            <input id="uUserEmail" type="email" class="input-style" placeholder="user@kurs.az" required />
          </div>
          <div id="uPasswordWrap">
            <label class="eyebrow mb-1.5 block">Şifrə * (min 8 simvol, hərf + rəqəm)</label>
            <input id="uUserPassword" type="password" class="input-style" placeholder="••••••••" minlength="8" autocomplete="new-password" />
          </div>
          <div>
            <label class="eyebrow mb-1.5 block">Rol *</label>
            <select id="uUserRole" class="input-style" onchange="onUserRoleChange()">
              <option value="admin">Admin</option>
              <option value="manager">Müdir (Manager)</option>
              <option value="reception">Reception</option>
              <option value="teacher">Müəllim</option>
              <option value="accountant">Mühasib</option>
              <option value="hr">HR</option>
            </select>
          </div>
          <div id="uBranchWrap">
            <label class="eyebrow mb-1.5 block">Filial Çıxışı</label>
            <select id="uUserBranch" class="input-style">
              <option value="all">Bütün Filiallar</option>
              ${getBranchOptions()}
            </select>
          </div>
          <div class="flex items-start gap-2.5 p-3 rounded-xl" style="background:var(--teal-50);border:1px solid var(--teal-100);">
            <i class="fa-solid fa-shield-halved text-sm mt-0.5" style="color:var(--teal-700);"></i>
            <p class="text-xs" style="color:var(--teal-700);">Yeni istifadəçi ayrı bir texniki sessiyada yaradılır — sizin öz girişiniz təsirlənmir.</p>
          </div>
          <button type="submit" class="w-full btn-primary py-3.5 rounded-2xl">
            <i class="fa-solid fa-check mr-2"></i> <span id="uSubmitLabel">Yarat</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Password Reset Modal (inline) -->
    <div id="usersPwModal" class="modal-bg" style="z-index:201;" aria-labelledby="usersPwModalTitle">
      <div class="overlay-surface rounded-[28px] p-6 sm:p-8 w-full max-w-md shadow-2xl">
        <div class="flex items-center justify-between mb-6 pb-4 border-b" style="border-color:var(--border);">
          <h3 id="usersPwModalTitle" class="font-head text-lg font-bold" style="color:var(--text-strong);"><i class="fa-solid fa-key mr-2" style="color:var(--gold-600);"></i>Şifrə Sıfırla</h3>
          <button onclick="closeModal('usersPwModal')"
            class="text-xl w-9 h-9 flex items-center justify-center rounded-full transition"
            style="color:var(--text-muted);" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background=''">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <p id="usersPwTarget" class="text-sm font-bold mb-4" style="color:var(--text-strong);"></p>
        <p class="text-xs mb-4" style="color:var(--text-muted);">Təhlükəsizlik səbəbindən şifrələr admin tərəfindən birbaşa təyin edilmir. İstifadəçiyə Firebase vasitəsilə sıfırlama linki göndəriləcək.</p>
        <button onclick="submitUserEmailReset()" class="w-full btn-blue py-3 rounded-2xl text-xs">
          <i class="fa-solid fa-envelope mr-2"></i>Sıfırlama Linki Göndər
        </button>
      </div>
    </div>
  `;

  document.getElementById('usersForm').addEventListener('submit', saveUser);
}

function renderUserRow(uid, u) {
  const isMe = state.user?.uid === uid;
  const roleLbl = RBAC.roleLabel(u.role || 'reception');
  const roleBadge = {
    admin: 'badge-red', manager: 'badge-purple', reception: 'badge-emerald',
    teacher: 'badge-blue', accountant: 'badge-amber', hr: 'badge-slate'
  }[u.role] || 'badge-slate';

  const branchLbl = (() => {
    if (u.branch === 'all') return 'Hamısı';
    const b = (state.branches || {})[u.branch] || { name: BRANCH_LABEL?.[u.branch] || u.branch };
    return b.name || u.branch || '—';
  })();

  const lastLogin = u.lastLogin
    ? new Date(u.lastLogin).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const isActive = u.active !== false;

  return `
    <tr class="border-b transition" style="border-color:var(--border);" data-uid="${uid}" data-name="${escapeHtml((u.name || u.email || '').toLowerCase())}">
      <td class="px-4 py-3" data-label="Ad">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 font-head" style="background:var(--teal-50);color:var(--teal-700);">
            ${escapeHtml((u.name || u.email || '?').charAt(0).toUpperCase())}
          </div>
          <div>
            <p class="text-sm font-bold flex items-center gap-1.5" style="color:var(--text-strong);">${escapeHtml(u.name || '—')}${isMe ? ' <span class="badge badge-emerald">Siz</span>' : ''}</p>
            <p class="text-xs sm:hidden" style="color:var(--text-muted);">${escapeHtml(u.email || '')}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-xs hidden sm:table-cell" style="color:var(--text-muted);" data-label="Email">${escapeHtml(u.email || '—')}</td>
      <td class="px-4 py-3" data-label="Rol"><span class="badge ${roleBadge}">${roleLbl}</span></td>
      <td class="px-4 py-3 text-xs hidden md:table-cell" style="color:var(--text-muted);" data-label="Filial">${escapeHtml(branchLbl)}</td>
      <td class="px-4 py-3 text-xs hidden lg:table-cell" style="color:var(--text-faint);" data-label="Son Giriş">${lastLogin}</td>
      <td class="px-4 py-3" data-label="Status">
        <span class="badge ${isActive ? 'badge-emerald' : 'badge-slate'}">${isActive ? 'Aktiv' : 'Deaktiv'}</span>
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1 justify-end">
          ${RBAC.can('users.edit') ? `
            <button onclick="openEditUserModal('${uid}')" title="Redaktə"
              class="w-8 h-8 rounded-lg flex items-center justify-center transition" style="color:var(--text-muted);"
              onmouseover="this.style.background='var(--surface-soft)';this.style.color='var(--text-strong)'" onmouseout="this.style.background='';this.style.color='var(--text-muted)'">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button onclick="openUserPwModal('${uid}')" title="Şifrə sıfırla"
              class="w-8 h-8 rounded-lg flex items-center justify-center transition" style="color:var(--text-muted);"
              onmouseover="this.style.background='var(--terracotta-50)';this.style.color='var(--terracotta-700)'" onmouseout="this.style.background='';this.style.color='var(--text-muted)'">
              <i class="fa-solid fa-key text-xs"></i>
            </button>
            <button onclick="toggleUserActive('${uid}',${isActive})" title="${isActive ? 'Deaktiv et' : 'Aktiv et'}"
              class="w-8 h-8 rounded-lg flex items-center justify-center transition" style="color:${isActive ? 'var(--teal-600)' : 'var(--text-muted)'};"
              onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background=''">
              <i class="fa-solid fa-toggle-${isActive ? 'on' : 'off'} text-sm"></i>
            </button>` : ''}
          ${RBAC.can('users.delete') && !isMe ? `
            <button onclick="deleteUserById('${uid}')" title="Sil"
              class="w-8 h-8 rounded-lg flex items-center justify-center transition" style="color:var(--text-muted);"
              onmouseover="this.style.background='var(--red-50)';this.style.color='var(--red-700)'" onmouseout="this.style.background='';this.style.color='var(--text-muted)'">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>` : ''}
        </div>
      </td>
    </tr>`;
}

// Debounced wrapper for the search input — this one only toggles row
// visibility (no innerHTML rebuild), so debouncing here is a smaller
// win than students/teachers, but still avoids running the per-row
// textContent scan on every keystroke. See students.js for the same
// pattern with more detail.
const debouncedFilterUsersTable = debounce('userSearchInput', () => filterUsersTable(), 200);

function filterUsersTable() {
  const q = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  document.querySelectorAll('#usersTableBody tr[data-uid]').forEach(row => {
    const name = row.dataset.name || '';
    const show = !q || name.includes(q) || row.textContent.toLowerCase().includes(q);
    row.style.display = show ? '' : 'none';
  });
}

/* =========================================================
   HELPERS
   ========================================================= */
function getBranchOptions() {
  // Dynamic branches (Phase 5) + legacy fallback
  const branches = state.branches || {};
  const entries = Object.entries(branches);
  if (entries.length > 0) {
    return entries.map(([id, b]) => `<option value="${escapeHtml(id)}">${escapeHtml(b.name || id)}</option>`).join('');
  }
  return `<option value="sheher">Şəhər Filialı</option><option value="goynuk">Göynük Filialı</option>`;
}

function onUserRoleChange() {
  const role = document.getElementById('uUserRole').value;
  const branchWrap = document.getElementById('uBranchWrap');
  const branchSel = document.getElementById('uUserBranch');
  if (branchWrap) branchWrap.style.display = role === 'admin' ? 'none' : '';
  // Show "all branches" option only when the selected role is admin-level
  if (branchSel) {
    const allOpt = branchSel.querySelector('option[value="all"]');
    if (allOpt) allOpt.style.display = (role === 'admin' || role === 'super_admin') ? '' : 'none';
    if (role !== 'admin' && role !== 'super_admin' && branchSel.value === 'all') {
      branchSel.value = 'sheher';
    }
  }
}

/* =========================================================
   CREATE / EDIT Modal
   ========================================================= */
let _editingUserId = null;

function openCreateUserModal() {
  _editingUserId = null;
  document.getElementById('usersModalTitle').textContent = 'Yeni İstifadəçi';
  document.getElementById('uSubmitLabel').textContent = 'Yarat';
  document.getElementById('uUid').value = '';
  document.getElementById('uFirstName').value = '';
  document.getElementById('uLastName').value = '';
  document.getElementById('uUserEmail').value = '';
  document.getElementById('uUserPassword').value = '';
  document.getElementById('uUserRole').value = 'reception';
  document.getElementById('uUserBranch').value = 'sheher';
  document.getElementById('uPasswordWrap').style.display = '';
  document.getElementById('uUserEmail').removeAttribute('readonly');
  onUserRoleChange();
  openModal('usersModal');
}

function openEditUserModal(uid) {
  const u = state.users[uid]; if (!u) return;
  _editingUserId = uid;
  document.getElementById('usersModalTitle').textContent = 'İstifadəçi Redaktə';
  document.getElementById('uSubmitLabel').textContent = 'Yadda Saxla';
  const nameParts = (u.name || '').split(' ');
  document.getElementById('uFirstName').value = nameParts[0] || '';
  document.getElementById('uLastName').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('uUserEmail').value = u.email || '';
  document.getElementById('uUserEmail').setAttribute('readonly', 'readonly');
  document.getElementById('uUserPassword').value = '';
  document.getElementById('uPasswordWrap').style.display = 'none';
  document.getElementById('uUserRole').value = u.role || 'reception';
  document.getElementById('uUserBranch').value = u.branch || 'sheher';
  onUserRoleChange();
  openModal('usersModal');
}

async function saveUser(e) {
  e.preventDefault();
  if (!RBAC.can('users.add') && !RBAC.can('users.edit')) return toast('İcazə yoxdur', 'error');

  const firstName = document.getElementById('uFirstName').value.trim();
  const lastName = document.getElementById('uLastName').value.trim();
  const email = document.getElementById('uUserEmail').value.trim();
  const password = document.getElementById('uUserPassword').value;
  const role = document.getElementById('uUserRole').value;
  const branch = role === 'admin' ? 'all' : document.getElementById('uUserBranch').value;

  if (!email) return toast('Email məcburidir', 'error');

  if (_editingUserId) {
    // Edit existing user (can't change email via client-side SDK)
    try {
      await db.ref('users/' + _editingUserId).update({
        name: [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0],
        role,
        branch,
      });
      // The DB write above triggers functions/src/customClaims.js's
      // syncUserClaims automatically — that alone is enough for
      // correctness (database.rules.json will see the new role/branch
      // next time this user's token refreshes, same as any Firebase
      // custom-claims change). This explicit resyncMyClaims call is
      // purely to shrink the propagation window: without it, an edited
      // user with an already-open tab could keep their OLD
      // role/branch permissions for up to ~1hr until their token's
      // natural refresh. Best-effort — if this call fails (e.g.
      // functions/ not deployed yet), the DB trigger still handles it
      // eventually, just slower, so a failure here doesn't need to
      // block or fail the edit itself.
      try { await fns.httpsCallable('resyncMyClaims')({ uid: _editingUserId }); } catch (_) { }
      await logAudit('edit_user', 'user', _editingUserId, email);
      toast('İstifadəçi yeniləndi');
      closeModal('usersModal');
    } catch (err) { toast('Xəta: ' + err.message, 'error'); }
  } else {
    // Create new user.
    // IMPORTANT: this must run on a SECONDARY Firebase app instance.
    // auth.createUserWithEmailAndPassword() on the primary `auth` object
    // signs the caller into the newly created account and drops their
    // own session — a real bug in the previous implementation. A
    // secondary app instance creates the account in an isolated
    // session so the admin's own login is never touched.
    if (!isStrongPassword(password)) return toast('Şifrə ən azı 8 simvol olmalı və ən azı bir hərf + bir rəqəm ehtiva etməlidir', 'error');
    const submitBtn = document.querySelector('#usersForm button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const secondary = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(firebaseConfig, 'secondary');
      const cred = await secondary.auth().createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      await db.ref('users/' + uid).set({
        email,
        name: [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0],
        role,
        branch,
        active: true,
        prefs: { theme: 'light', sound: false, anims: true },
        createdAt: Date.now(),
        createdBy: state.user?.uid || null,
      });
      await secondary.auth().signOut();
      await logAudit('create_user', 'user', uid, email + ' role:' + role);
      toast('İstifadəçi yaradıldı: ' + email);
      closeModal('usersModal');
    } catch (err) { toast('Xəta: ' + err.message, 'error'); }
    finally { if (submitBtn) submitBtn.disabled = false; }
  }
}

/* =========================================================
   ACTIVATE / DEACTIVATE / DELETE
   ---------------------------------------------------------
   These now call the deployed Cloud Functions in functions/src/
   (setUserActive, deleteUserAccount) first, since those are the only
   path that can touch the user's actual Firebase Auth account —
   disabling/deleting it there, not just the users/{uid} database
   profile. See functions/src/userAdmin.js for what each one does and
   why (it closes the "soft-delete leaves a fully working Auth account
   behind" gap that a purely client-side app can't close on its own).

   FALLBACK: if functions/ hasn't been deployed yet for this project
   (firebase deploy --only functions), the callable request fails with
   a 'not-found'/'internal' error recognizable via _isFunctionsUnavailable().
   In that case we fall back to the old client-only, DB-only behavior
   so the button doesn't just break for anyone mid-migration — but we
   surface a visible warning so it's obvious the Auth account itself
   was NOT touched, rather than silently pretending it's fully deleted.
   ========================================================= */
function _isFunctionsUnavailable(err) {
  // Cloud Functions callable errors that mean "no such function deployed"
  // rather than "the function ran and rejected the request".
  return err?.code === 'functions/not-found' || err?.code === 'functions/internal' || err?.code === 'functions/unavailable';
}

async function toggleUserActive(uid, currentlyActive) {
  if (!RBAC.can('users.edit')) return toast('İcazə yoxdur', 'error');
  const newState = !currentlyActive;
  try {
    await fns.httpsCallable('setUserActive')({ uid, active: newState });
    toast(newState ? 'İstifadəçi aktivləşdirildi (Auth + profil)' : 'İstifadəçi deaktiv edildi (Auth + profil)');
    // setUserActive already writes its own audit entry server-side —
    // no client-side logAudit call needed here (avoids a duplicate,
    // client-forgeable entry for the same action).
  } catch (err) {
    if (_isFunctionsUnavailable(err)) {
      // Fallback: old DB-only behavior (functions/ not deployed yet).
      try {
        await db.ref('users/' + uid + '/active').set(newState);
        await logAudit(newState ? 'activate_user' : 'deactivate_user', 'user', uid, 'client-only fallback — functions not deployed');
        toast((newState ? 'İstifadəçi aktivləşdirildi' : 'İstifadəçi deaktiv edildi') + ' (yalnız profil — Cloud Function deploy edilməyib)', 'info');
      } catch (fallbackErr) { toast('Xəta: ' + fallbackErr.message, 'error'); }
    } else {
      toast('Xəta: ' + (err.message || err.code), 'error');
    }
  }
}

function deleteUserById(uid) {
  if (!RBAC.can('users.delete')) return toast('İcazə yoxdur', 'error');
  const u = state.users[uid];
  confirmAction('İstifadəçi silinsin?', (u?.name || u?.email || uid) + ' sistemdən silinəcək (Auth hesabı və profil).', async () => {
    try {
      await fns.httpsCallable('deleteUserAccount')({ uid });
      toast('İstifadəçi silindi (Auth hesabı və profil)');
      // deleteUserAccount already writes its own server-side audit entry.
    } catch (err) {
      if (_isFunctionsUnavailable(err)) {
        // Fallback: soft-delete only, same as before this Cloud Function
        // existed. The Auth account is NOT removed in this path — say so.
        try {
          await db.ref('users/' + uid).update({ active: false, deletedAt: Date.now(), deletedBy: state.user?.uid });
          await logAudit('delete_user', 'user', uid, (u?.email || uid) + ' — client-only fallback, Auth account NOT deleted');
          toast('İstifadəçi silindi (yalnız profil deaktiv edildi — Auth hesabı qalır, çünki Cloud Function deploy edilməyib)', 'info');
        } catch (fallbackErr) { toast('Xəta: ' + fallbackErr.message, 'error'); }
      } else {
        toast('Xəta: ' + (err.message || err.code), 'error');
      }
    }
  });
}

/* =========================================================
   PASSWORD RESET
   Passwords are never set directly by an admin — this sends a Firebase
   password-reset email instead. The previous "new password" path wrote
   the plaintext password to pendingPasswords/{uid} in the database and
   applied it on next login; that mechanism has been removed entirely
   (see SECURITY_RULES_README.md for why).
   ========================================================= */
let _pwResetUid = null;

function openUserPwModal(uid) {
  _pwResetUid = uid;
  const u = state.users[uid]; if (!u) return;
  document.getElementById('usersPwTarget').textContent = u.name || u.email || uid;
  openModal('usersPwModal');
}

async function submitUserEmailReset() {
  const uid = _pwResetUid; if (!uid) return;
  const u = state.users[uid]; if (!u?.email) return;
  try {
    await auth.sendPasswordResetEmail(u.email);
    await logAudit('password_reset_email', 'user', uid, u.email);
    toast('Sıfırlama linki göndərildi: ' + u.email);
    closeModal('usersPwModal');
  } catch (err) { toast('Xəta: ' + err.message, 'error'); }
}
