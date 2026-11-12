/* ================= SETTINGS ================= */
function renderSettings() {
  const v = $('view-settings');
  const isAdmin = isAdminRole();
  const isDark = document.documentElement.classList.contains('dark-mode');
  v.innerHTML = `
<div class="grid lg:grid-cols-2 gap-5">
  <div class="glass rounded-3xl p-6">
    <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);"><i class="fa-solid fa-user mr-2" style="color:var(--accent-text);"></i>Profil</h3>
    <div class="space-y-3">
      <div><p class="eyebrow">Email</p><p class="text-sm font-bold mt-0.5" style="color:var(--text-strong);">${state.profile.email}</p></div>
      <div><p class="eyebrow">Rol</p><span class="badge badge-emerald mt-1 inline-block">${ROLE_LABEL[state.profile.role]}</span></div>
      <div><p class="eyebrow">Filial</p><p class="text-sm font-bold mt-0.5" style="color:var(--text-strong);">${BRANCH_LABEL[state.profile.branch] || 'Hamısı'}</p></div>
    </div>
    <div class="border-t mt-5 pt-5" style="border-color:var(--border);">
      <p class="eyebrow mb-3">Şifrəni dəyiş</p>
      <form id="passwordForm" class="space-y-3">
        <input type="password" id="currentPassword" class="input-style" placeholder="Cari şifrə" required autocomplete="current-password" />
        <input type="password" id="newPassword" class="input-style" placeholder="Yeni şifrə (min 8, hərf + rəqəm)" minlength="8" required autocomplete="new-password" />
        <input type="password" id="newPasswordConfirm" class="input-style" placeholder="Yeni şifrəni təkrar yazın" minlength="8" required autocomplete="new-password" />
        <p id="pwStrengthHint" class="text-[11px]" style="color:var(--text-muted);">Ən azı 8 simvol, ən azı bir hərf və bir rəqəm olmalıdır.</p>
        <button class="btn-primary w-full"><i class="fa-solid fa-key mr-2"></i>Şifrəni yenilə</button>
      </form>
    </div>
  </div>

  <div class="glass rounded-3xl p-6">
    <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);"><i class="fa-solid fa-palette mr-2" style="color:var(--plum-600);"></i>Görünüş Parametrləri</h3>
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-bold" style="color:var(--text-strong);">Tünd mövzu (Dark mode)</p>
          <p class="text-[11px] mt-0.5" style="color:var(--text-muted);">Az işıqlı mühitdə gözünüzü qoruyun</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="prefTheme" class="sr-only peer" ${isDark ? 'checked' : ''} onchange="updatePref('theme', this.checked ? 'dark' : 'light')">
          <div class="settings-switch"></div>
        </label>
      </div>
      <div class="flex items-center justify-between border-t pt-4" style="border-color:var(--border);">
        <div>
          <p class="text-sm font-bold" style="color:var(--text-strong);">Səs Effektləri</p>
          <p class="text-[11px] mt-0.5" style="color:var(--text-muted);">Düymələrə basarkən qısa audio siqnalı</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="prefSound" class="sr-only peer" ${state.profile.prefs?.sound ? 'checked' : ''} onchange="updatePref('sound', this.checked)">
          <div class="settings-switch"></div>
        </label>
      </div>
      <div class="flex items-center justify-between border-t pt-4" style="border-color:var(--border);">
        <div>
          <p class="text-sm font-bold" style="color:var(--text-strong);">Keçid animasiyaları</p>
          <p class="text-[11px] mt-0.5" style="color:var(--text-muted);">Səhifə və kart keçidlərində yumşaq animasiya</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="prefAnims" class="sr-only peer" ${state.profile.prefs?.anims !== false ? 'checked' : ''} onchange="updatePref('anims', this.checked)">
          <div class="settings-switch"></div>
        </label>
      </div>
    </div>
  </div>

  <div class="glass rounded-3xl p-6">
    <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);"><i class="fa-solid fa-book mr-2" style="color:var(--azure-600);"></i>Tədris ili fənləri</h3>
    <div class="flex flex-wrap gap-2 mb-4">
      ${state.subjects.map((s, i) => `<span class="badge badge-slate flex items-center gap-2">${escapeHtml(s)}${can('subjects') ? ` <button onclick="removeSubject('subjects',${i})" style="color:var(--red-600);"><i class="fa-solid fa-xmark"></i></button>` : ''}</span>`).join('') || `<p class="text-xs" style="color:var(--text-faint);">Fənn əlavə edilməyib</p>`}
    </div>
    ${can('subjects') ? `<form id="subjectForm" class="flex gap-2"><input id="newSubject" class="input-style flex-1" placeholder="Yeni fənn"/><button class="btn-blue px-4"><i class="fa-solid fa-plus"></i></button></form>` : ''}

    <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4 mt-6" style="color:var(--text-strong);"><i class="fa-solid fa-sun mr-2" style="color:var(--gold-600);"></i>Yay kursu fənləri</h3>
    <div class="flex flex-wrap gap-2 mb-4">
      ${state.summerSubjects.map((s, i) => `<span class="badge badge-amber flex items-center gap-2">${escapeHtml(s)}${can('subjects') ? ` <button onclick="removeSubject('summerSubjects',${i})" style="color:var(--red-600);"><i class="fa-solid fa-xmark"></i></button>` : ''}</span>`).join('') || `<p class="text-xs" style="color:var(--text-faint);">Fənn əlavə edilməyib</p>`}
    </div>
    ${can('subjects') ? `<form id="summerSubjectForm" class="flex gap-2"><input id="newSummerSubject" class="input-style flex-1" placeholder="Yeni yay fənni"/><button class="btn-amber px-4"><i class="fa-solid fa-plus"></i></button></form>` : ''}
  </div>

  ${isAdmin ? `
  <div class="glass rounded-3xl p-6 lg:col-span-2">
    <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);"><i class="fa-solid fa-clock-rotate-left mr-2" style="color:var(--plum-600);"></i>Audit log (son 200)</h3>
    <div class="space-y-1.5 max-h-96 overflow-y-auto pr-1">
      ${(() => {
        const items = Object.values(state.audit || {}).sort((a, b) => b.ts - a.ts);
        if (!items.length) return `<div class="empty-state py-10"><i class="fa-regular fa-clock"></i><p>Hələ qeyd yoxdur</p></div>`;
        const actLabel = { create: ['Yeni', 'badge-emerald'], update: ['Redaktə', 'badge-blue'], delete: ['Silmə', 'badge-red'], payment_toggle: ['Ödəniş', 'badge-purple'], hours_set: ['Saatlar', 'badge-amber'] };
        return items.map(a => {
          const lbl = actLabel[a.action] || [a.action, 'badge-slate'];
          return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl glass-soft text-xs">
            <span class="badge ${lbl[1]} shrink-0">${lbl[0]}</span>
            <span class="font-bold flex-1 truncate" style="color:var(--text-strong);">${escapeHtml(a.entity || '')} · ${escapeHtml(a.details || '')}</span>
            <span class="truncate shrink-0 max-w-[140px]" style="color:var(--text-muted);">${escapeHtml(a.userEmail || '')}</span>
            <span class="shrink-0" style="color:var(--text-faint);">${new Date(a.ts).toLocaleString('az-AZ')}</span>
          </div>`;
        }).join('');
      })()}
    </div>
  </div>`: ''}
</div>
  `;

  $('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = $('currentPassword').value;
    const next = $('newPassword').value;
    const confirm = $('newPasswordConfirm').value;

    if (!isStrongPassword(next)) {
      return toast('Yeni şifrə ən azı 8 simvol olmalı və ən azı bir hərf + bir rəqəm ehtiva etməlidir', 'error');
    }
    if (next !== confirm) {
      return toast('Yeni şifrə təkrarı uyğun gəlmir', 'error');
    }
    if (next === current) {
      return toast('Yeni şifrə cari şifrədən fərqli olmalıdır', 'error');
    }

    const submitBtn = $('passwordForm').querySelector('button[type="submit"], button:not([type])');
    if (submitBtn) submitBtn.disabled = true;
    try {
      // Firebase requires a "recent" sign-in for updatePassword(); rather
      // than let that fail opaquely, reauthenticate explicitly with the
      // current password first — this also doubles as a genuine identity
      // check before the destructive change (closes the "no reauth on
      // password change" gap).
      const cred = firebase.auth.EmailAuthProvider.credential(state.profile.email, current);
      await state.user.reauthenticateWithCredential(cred);
      await state.user.updatePassword(next);
      toast('Şifrə yeniləndi');
      $('passwordForm').reset();
      logAudit('password_change_self', 'user', state.user.uid, state.profile.email);
    } catch (err) {
      const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Cari şifrə yanlışdır'
        : 'Xəta: ' + (err.message || err.code);
      toast(msg, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Inject extra admin/manager cards into settings (AI quota + Export)
  try { renderExtraSettingsCards(); } catch (e) { console.error(e); }

  if (isAdmin) {
    $('subjectForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('newSubject').value.trim(); if (!v) return;
      if (!isSafeSubjectName(v)) { toast("Fənn adı yalnız hərf, rəqəm, boşluq və - ( ) simvollarından ibarət ola bilər", "error"); return; }
      await db.ref('settings/subjects').set([...state.subjects, v]);
      $('newSubject').value = ''; toast("Fənn əlavə edildi");
    });
    $('summerSubjectForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = $('newSummerSubject').value.trim(); if (!v) return;
      if (!isSafeSubjectName(v)) { toast("Fənn adı yalnız hərf, rəqəm, boşluq və - ( ) simvollarından ibarət ola bilər", "error"); return; }
      await db.ref('settings/summerSubjects').set([...state.summerSubjects, v]);
      $('newSummerSubject').value = ''; toast("Yay fənni əlavə edildi");
    });
  }
}

// Subject names are shown as HTML badges and <option> values app-wide; only allow
// plain text (letters incl. Azerbaijani, digits, spaces, - and parentheses).
function isSafeSubjectName(v) {
  return /^[\p{L}\p{N} .,'\-()]{1,60}$/u.test(v);
}

async function removeSubject(which, idx) {
  if (!can('subjects.edit')) return toast('İcazə yoxdur', 'error');
  const list = state[which].filter((_, i) => i !== idx);
  await db.ref('settings/' + which).set(list);
  toast("Fənn silindi", "info");
}
