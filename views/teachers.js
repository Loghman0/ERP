/* ================= TEACHERS ================= */
function renderTeachers() {
  const v = $('view-teachers');
  // Same reasoning as views/students.js's renderStudents(): live
  // Firebase updates re-render via this same function on every
  // snapshot (js/router.js's scopedCollectionListener → renderCurrent()
  // → switchView(..., true) → renderTeachers()), not just genuine
  // navigation into the view. Rebuilding the whole shell unconditionally
  // wipes whatever the user was mid-typing in the search box and resets
  // the role filter dropdown back to "all" on every single update
  // anywhere in the teachers collection. When the shell already exists,
  // just refresh the card grid itself.
  if (v.dataset.teachersShellReady === '1') {
    renderTeacherList(); // preserves search text + role filter selection
    return;
  }
  v.dataset.teachersShellReady = '1';
  v.innerHTML = `
<div class="flex justify-between items-center mb-5 gap-3 flex-wrap">
  <input id="teacherSearch" class="input-style flex-1 max-w-md" placeholder="Axtarış: ad, vəzifə, fənn..." oninput="debouncedRenderTeacherList()" />
  <select id="teacherRoleFilter" class="input-style sm:w-48" onchange="renderTeacherList()">
    <option value="all">Bütün vəzifələr</option>
    <option value="teacher">Müəllim</option>
    <option value="reception">Reception</option>
    <option value="manager">Menecer</option>
    <option value="admin">Administrator</option>
    <option value="janitor">Xadimə</option>
    <option value="other">Digər</option>
  </select>
  <button onclick="openTeacherModal()" class="btn-blue"><i class="fa-solid fa-plus mr-2"></i>Yeni Kadr</button>
</div>
<div id="teacherList" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
  `;
  renderTeacherList();
}

// Debounced wrapper for the search input — see students.js's
// debouncedRenderStudentTable for the same reasoning.
const debouncedRenderTeacherList = debounce('teacherSearch', () => renderTeacherList(), 200);

function renderTeacherList() {
  const q = ($('teacherSearch')?.value || '').toLowerCase();
  const roleF = $('teacherRoleFilter')?.value || 'all';
  const list = filterByBranch(state.teachers).map(([id, t]) => ({ id, ...t }))
    .filter(t => roleF === 'all' || staffRole(t) === roleF)
    .filter(t => !q || (`${t.name || ''} ${t.subject || ''} ${t.phone || ''} ${STAFF_ROLE_LABEL[staffRole(t)]}`).toLowerCase().includes(q));

  const studentsByTeacher = {};
  Object.values(state.students).forEach(s => {
    getStudentSubjects(s).forEach(sub => {
      if (sub.teacherId) studentsByTeacher[sub.teacherId] = (studentsByTeacher[sub.teacherId] || 0) + 1;
    });
  });

  if (list.length === 0) { $('teacherList').innerHTML = `<div class="col-span-full">${emptyStateHTML('fa-chalkboard-user', 'Kadr tapılmadı')}</div>`; return; }

  $('teacherList').innerHTML = list.map(t => {
    const role = staffRole(t);
    const isTeacher = role === 'teacher';
    const st = teacherSalaryType(t);
    let salaryDisplay = '-', salaryHint = '';
    if (!isTeacher) { salaryDisplay = fmt(t.fixedSalary ?? t.salary); salaryHint = 'Sabit aylıq'; }
    else if (st === 'fixed') { salaryDisplay = fmt(t.monthlySalary ?? t.salary); salaryHint = 'Sabit aylıq'; }
    else if (st === 'hourly') { salaryDisplay = fmt(t.hourlyRate) + '/saat'; salaryHint = 'Saatlıq'; }
    else { salaryDisplay = (t.teacherSharePct ?? 50) + '%'; salaryHint = 'Şagird gəlirindən'; }
    return `
<div class="glass rounded-3xl p-5 slide-up">
  <div class="flex items-start gap-4">
    <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold font-head shrink-0" style="background:var(--teal-50);color:var(--teal-700);">${escapeHtml((t.name || 'M').charAt(0))}</div>
    <div class="flex-1 min-w-0">
      <h4 class="font-bold truncate" style="color:var(--text-strong);">${escapeHtml(t.name || '')}</h4>
      <p class="text-xs mt-0.5" style="color:var(--text-muted);">${escapeHtml(isTeacher ? (t.subject || '') : STAFF_ROLE_LABEL[role])}</p>
      <div class="flex flex-wrap gap-1.5 mt-2">
        <span class="badge ${STAFF_ROLE_BADGE[role]}">${STAFF_ROLE_LABEL[role]}</span>
        <span class="badge ${t.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${BRANCH_LABEL[t.branch] || '-'}</span>
        ${isTeacher ? `<span class="badge badge-slate">${studentsByTeacher[t.id] || 0} şagird</span><span class="badge badge-purple">${SALARY_TYPE_LABEL[st]}</span>` : ''}
      </div>
    </div>
  </div>
  <div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t" style="border-color:var(--border);">
    <div>
      <p class="eyebrow">Telefon</p>
      <p class="text-xs font-bold mt-0.5" style="color:var(--text-strong);">${escapeHtml(t.phone || '-')}</p>
    </div>
    <div>
      <p class="eyebrow">${salaryHint}</p>
      <p class="text-xs font-bold mt-0.5" style="color:var(--accent-text);">${salaryDisplay}</p>
    </div>
  </div>
  <div class="flex gap-2 mt-4">
    ${isTeacher && st === 'hourly' ? `<button onclick="openHoursModal('${t.id}')" class="flex-1 btn-ghost" style="color:var(--gold-600);"><i class="fa-solid fa-clock mr-1"></i>Saatlar</button>` : ''}
    <button onclick="openTeacherProfile('${t.id}')" class="flex-1 btn-ghost" style="color:var(--accent-text);"><i class="fa-solid fa-address-card mr-1"></i>Profil</button>
    ${can('teachers.edit') ? `<button onclick="openTeacherModal('${t.id}')" class="flex-1 btn-ghost" style="color:var(--azure-600);"><i class="fa-solid fa-pen mr-1"></i>Redaktə</button>` : ''}
    ${can('teachers.delete') ? `<button onclick="deleteTeacher('${t.id}')" class="btn-ghost" style="color:var(--red-600);"><i class="fa-solid fa-trash"></i></button>` : ''}
  </div>
</div>`;
  }).join('');
}

function setSalaryType(type) {
  $('tSalaryType').value = type;
  document.querySelectorAll('#tSalaryTypeChips .chip').forEach(c => c.classList.toggle('active', c.dataset.value === type));
  $('tFixedWrap').classList.toggle('hidden', type !== 'fixed');
  $('tHourlyWrap').classList.toggle('hidden', type !== 'hourly');
  $('tShareWrap').classList.toggle('hidden', type !== 'revenue_share');
}

function fillBranchSelect(selId) {
  const el = $(selId);
  if (!isAdminRole()) {
    el.innerHTML = `<option value="${state.profile.branch}">${BRANCH_LABEL[state.profile.branch]} Filialı</option>`;
    el.disabled = true;
  } else {
    el.innerHTML = `<option value="sheher">Şəhər Filialı</option><option value="goynuk">Göynük Filialı</option>`;
    el.disabled = false;
  }
}

function onStaffRoleChange() {
  const role = $('tStaffRole').value || 'teacher';
  const isTeacher = role === 'teacher';
  $('tTeacherFieldsWrap').classList.toggle('hidden', !isTeacher);
  $('tBranchOnlyWrap').classList.toggle('hidden', isTeacher);
  $('tNonTeacherWrap').classList.toggle('hidden', isTeacher);
  $('tSalaryBlockWrap').classList.toggle('hidden', !isTeacher);
  $('tSubject').required = isTeacher;
  $('tBranch').required = isTeacher;
  $('tBranchOnly').required = !isTeacher;
}

function openTeacherModal(id) {
  $('tSubject').innerHTML = '<option value="">Fənn *</option>' + state.subjects.concat(state.summerSubjects).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  fillBranchSelect('tBranch');
  fillBranchSelect('tBranchOnly');
  if (id) {
    const t = state.teachers[id]; if (!t) return;
    $('teacherModalTitle').textContent = "Kadrı Redaktə Et";
    $('tId').value = id;
    $('tStaffRole').value = staffRole(t);
    onStaffRoleChange();
    $('tName').value = t.name || ''; $('tPhone').value = t.phone || '';
    $('tSubject').value = t.subject || ''; $('tBranch').value = t.branch || state.profile.branch;
    $('tBranchOnly').value = t.branch || state.profile.branch;
    $('tFixedSalary').value = t.fixedSalary ?? t.monthlySalary ?? '';
    const st = teacherSalaryType(t);
    setSalaryType(st);
    $('tMonthlySalary').value = t.monthlySalary ?? t.salary ?? '';
    $('tHourlyRate').value = t.hourlyRate ?? '';
    $('tTeacherSharePct').value = t.teacherSharePct ?? 50;
  } else {
    $('teacherModalTitle').textContent = "Yeni Kadr";
    $('teacherForm').reset();
    $('tId').value = '';
    $('tStaffRole').value = 'teacher';
    onStaffRoleChange();
    $('tBranch').value = state.profile.role === 'admin' ? 'sheher' : state.profile.branch;
    $('tBranchOnly').value = state.profile.role === 'admin' ? 'sheher' : state.profile.branch;
    setSalaryType('fixed');
    $('tTeacherSharePct').value = 50;
  }
  openModal('teacherModal');
}

$('teacherForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('tId').value;
  const role = $('tStaffRole').value || 'teacher';
  const isTeacher = role === 'teacher';
  const st = isTeacher ? ($('tSalaryType').value || 'fixed') : 'fixed';
  const branch = isTeacher ? $('tBranch').value : $('tBranchOnly').value;
  const data = {
    name: $('tName').value.trim(), phone: $('tPhone').value.trim(),
    staffRole: role,
    subject: isTeacher ? $('tSubject').value : '',
    branch: branch,
    salaryType: st,
    monthlySalary: isTeacher && st === 'fixed' ? (Number($('tMonthlySalary').value) || 0) : null,
    hourlyRate: isTeacher && st === 'hourly' ? (Number($('tHourlyRate').value) || 0) : null,
    teacherSharePct: isTeacher && st === 'revenue_share' ? Math.max(0, Math.min(100, Number($('tTeacherSharePct').value) || 50)) : null,
    fixedSalary: !isTeacher ? (Number($('tFixedSalary').value) || 0) : null,
    updatedAt: Date.now(),
  };
  // Mirror to old `salary` for backward compat
  data.salary = isTeacher && st === 'fixed' ? data.monthlySalary : (!isTeacher ? data.fixedSalary : 0);
  try {
    if (id) {
      if (!can('teachers.edit')) return toast('Redaktə icazəniz yoxdur', 'error');
      await db.ref('teachers/' + id).update(data);
      await logAudit('update', 'teacher', id, data.name);
      toast("Müəllim yeniləndi");
    } else {
      if (!can('teachers.add')) return toast('Əlavə etmə icazəniz yoxdur', 'error');
      data.createdAt = Date.now();
      const ref = await db.ref('teachers').push(data);
      await logAudit('create', 'teacher', ref.key, data.name);
      toast("Müəllim əlavə edildi");
    }
    closeModal('teacherModal');
  } catch (err) { toast("Xəta: " + err.message, "error"); }
});

function deleteTeacher(id) {
  const t = state.teachers[id]; if (!t) return;
  if (!can('teachers.delete')) return toast('Silmə icazəniz yoxdur', 'error');
  if (!canEdit(t)) return toast("İcazə yoxdur", "error");

  // Referential-integrity check: deleting a teacher record used to leave
  // any student.subjects[].teacherId / schedule entry pointing at a now-
  // nonexistent id, with no warning beyond a passing mention of the
  // linked-student count in the confirm dialog — deletion still went
  // through either way. Now it's a hard stop: reassign or remove those
  // links first, then delete. (See audit Section 2.4.)
  const linkedStudents = Object.entries(state.students || {})
    .filter(([, s]) => getStudentSubjects(s).some(sub => sub.teacherId === id))
    .map(([, s]) => s.name || 'Adsız şagird');
  const linkedSchedule = Object.values(state.schedule || {})
    .filter(e => e.teacherId === id).length;

  if (linkedStudents.length > 0 || linkedSchedule > 0) {
    const parts = [];
    if (linkedStudents.length > 0) {
      const names = linkedStudents.slice(0, 5).join(', ') + (linkedStudents.length > 5 ? ` və daha ${linkedStudents.length - 5} nəfər` : '');
      parts.push(`${linkedStudents.length} şagird fənni (${names})`);
    }
    if (linkedSchedule > 0) parts.push(`${linkedSchedule} cədvəl qeydi`);
    return toast(
      `Bu müəllimi silmək olmur: ${parts.join(' və ')} ona bağlıdır. Əvvəlcə həmin fənn/cədvəl qeydlərini başqa müəllimə keçirin və ya silin.`,
      'error'
    );
  }

  confirmAction("Kadrı silmək?", `${t.name} silinəcək.`, async () => {
    await db.ref('teachers/' + id).remove();
    await logAudit('delete', 'teacher', id, t.name);
    toast("Silindi", "info");
  });
}

/* ==== TEACHER PROFILE ==== */
function openTeacherProfile(id) {
  const t = state.teachers[id]; if (!t) return;
  const role = staffRole(t);
  const isTeacher = role === 'teacher';
  const st = teacherSalaryType(t);

  $('tpAvatar').textContent = (t.name || 'M').charAt(0);
  $('tpName').textContent = t.name || '';

  const badgesHTML = `
    <span class="badge ${STAFF_ROLE_BADGE[role] || 'badge-slate'}">${STAFF_ROLE_LABEL[role]}</span>
    <span class="badge ${t.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${BRANCH_LABEL[t.branch] || '-'}</span>
    ${isTeacher ? `<span class="badge badge-purple">${SALARY_TYPE_LABEL[st]}</span>` : ''}
  `;
  $('tpBadges').innerHTML = badgesHTML;

  $('tpBranch').textContent = BRANCH_LABEL[t.branch] || '-';
  $('tpSubject').textContent = isTeacher ? (t.subject || '-') : '-';

  let salaryDisplay = '-';
  if (!isTeacher) { salaryDisplay = fmt(t.fixedSalary ?? t.salary); }
  else if (st === 'fixed') { salaryDisplay = fmt(t.monthlySalary ?? t.salary); }
  else if (st === 'hourly') { salaryDisplay = fmt(t.hourlyRate) + '/saat'; }
  else { salaryDisplay = (t.teacherSharePct ?? 50) + '%'; }
  $('tpSalary').textContent = salaryDisplay;

  // Linked Students
  const linked = [];
  Object.entries(state.students).forEach(([sid, s]) => {
    const matchingSubs = getStudentSubjects(s).filter(sub => sub.teacherId === id);
    if (matchingSubs.length > 0) {
      linked.push({ id: sid, student: s, subs: matchingSubs });
    }
  });
  $('tpStudentCount').textContent = linked.length;

  const listWrap = $('tpStudentList');
  if (linked.length === 0) {
    listWrap.innerHTML = `<p class="text-xs italic" style="color:var(--text-faint);">Müəllimə bağlı aktiv şagird yoxdur.</p>`;
  } else {
    listWrap.innerHTML = linked.map(({ id: sid, student: s, subs }) => {
      const names = subs.map(x => x.subject).join(', ');
      const mathTotal = subs.reduce((sum, sub) => sum + computeSubjectMath(sub, t).teacherEarn, 0);
      return `<div class="p-3 rounded-xl glass-soft cursor-pointer flex justify-between items-center transition" style="border-color:var(--border);" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background=''" onclick="openStudentProfile('${sid}')">
        <div>
           <p class="text-sm font-bold" style="color:var(--text-strong);">${escapeHtml((s.name || '') + ' ' + (s.surname || ''))}</p>
           <p class="text-[11px] mt-1" style="color:var(--text-muted);">${escapeHtml(names)} · ${classLabel(s.class)}</p>
        </div>
        ${isTeacher ? `<div class="text-right">
          <span class="text-xs font-bold" style="color:var(--accent-text);">+${fmt(mathTotal)}</span>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  $('tpEditBtn').onclick = () => { closeModal('teacherProfileModal'); openTeacherModal(id); };

  const aiBtn = $('tpAiBtn');
  const aiRes = $('tpAiResult');
  aiRes.classList.add('hidden');
  aiRes.innerHTML = '';

  aiBtn.onclick = async () => {
    if (!can('ai')) return toast('AI icazəsi yoxdur', 'error');
    aiRes.classList.remove('hidden');
    aiRes.innerHTML = `<div class="flex items-center justify-center py-3" style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Analiz edilir...</div>`;
    try {
      const sys = [
        MERAM_PROMPTS.baseRules(),
        MERAM_PROMPTS.scopeRules(state.profile),
        `\nSƏN İNDİ HR analitikisən. Müəllimin performans hesabatını ver.
Struktur:
## Yük və Şagird Portfeli
## Gəlir Töhfəsi
## Maaş Strukturu
## Diqqət Tələb Edən Məqamlar
## Tövsiyələr (2-4)`
      ].join('\n');
      const details = {
        name: t.name,
        subject: t.subject,
        branch: t.branch,
        students: linked.map(l => ({ name: l.student.name, class: l.student.class, enrollment: l.student.enrollmentType, price: l.subs.map(x => x.price) })),
        salaryType: st,
        salary: salaryDisplay
      };
      const text = await callGemini(`Bu müəllimin profilidir:\n${JSON.stringify(details, null, 2)}\nZəhmət olmasa təhlil et.`, { systemInstruction: sys });
      aiRes.innerHTML = renderMD(text);
    } catch (e) {
      aiRes.innerHTML = `<p class="text-xs" style="color:var(--red-700);"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${escapeHtml(e.message)}</p>`;
    }
  };

  openModal('teacherProfileModal');
}

/* ---- Teacher hours ---- */
function openHoursModal(tid) {
  const t = state.teachers[tid]; if (!t) return;
  $('hTeacherId').value = tid;
  $('hoursTeacherName').textContent = t.name + ' · ' + (t.hourlyRate || 0) + ' AZN/saat';
  $('hMonth').value = monthKey(today());
  $('hHours').value = (t.hours || {})[$('hMonth').value] || '';
  renderHoursList(t);
  openModal('hoursModal');
}

function renderHoursList(t) {
  const hours = t.hours || {};
  const entries = Object.entries(hours).sort((a, b) => b[0].localeCompare(a[0]));
  $('hoursList').innerHTML = entries.length === 0
    ? `<p class="text-xs text-center py-2" style="color:var(--text-faint);">Qeyd yoxdur</p>`
    : entries.map(([m, h]) => `<div class="flex justify-between items-center p-2 rounded-lg glass-soft"><span class="text-xs font-bold" style="color:var(--text-strong);">${m}</span><span class="text-xs font-bold" style="color:var(--gold-600);">${h} saat · ${fmt((t.hourlyRate || 0) * h)}</span></div>`).join('');
}

$('hoursForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tid = $('hTeacherId').value;
  const m = $('hMonth').value;
  const h = Number($('hHours').value) || 0;
  await db.ref('teachers/' + tid + '/hours/' + m).set(h);
  await logAudit('hours_set', 'teacher', tid, `${m}: ${h} saat`);
  toast('Saatlar yadda saxlandı');
  const t = state.teachers[tid]; if (t) { t.hours = t.hours || {}; t.hours[m] = h; renderHoursList(t); }
});

