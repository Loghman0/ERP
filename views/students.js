/* ================= STUDENTS ================= */
function renderStudents() {
  const v = $('view-students');
  // Live Firebase updates (a student added/edited elsewhere) re-render
  // via this same function on every snapshot (see js/router.js's
  // scopedCollectionListener → renderCurrent() → switchView(...,
  // true) → renderStudents()) — not just genuine navigation into the
  // view. Rebuilding the entire innerHTML unconditionally on every
  // single live update wipes whatever the user was mid-typing in the
  // search box and resets pagination back to page 1 every time ANY
  // student anywhere changes, which defeats both the debounce and the
  // pagination work below. When the view's shell already exists, only
  // refresh the pieces that actually depend on data that could have
  // changed (subject filter options, since state.subjects/
  // summerSubjects can change) and the table itself — leaving the
  // search input, filter selections, and current page untouched.
  const alreadyRendered = v.dataset.studentsShellFor === state.studentEnrollmentFilter;
  if (alreadyRendered) {
    const subjectSelect = $('filterSubject');
    if (subjectSelect) {
      const currentVal = subjectSelect.value;
      subjectSelect.innerHTML = `<option value="">Bütün fənlər</option>` +
        (state.studentEnrollmentFilter === 'summer' ? state.summerSubjects : state.subjects)
          .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      subjectSelect.value = currentVal; // restore selection if it still exists in the list
    }
    renderStudentTable(); // no reset — preserve current page/search/filter
    return;
  }
  v.dataset.studentsShellFor = state.studentEnrollmentFilter;
  v.innerHTML = `
<div class="flex items-center gap-2 mb-5 p-1 glass-soft rounded-2xl w-fit">
  <div class="pill-tab ${state.studentEnrollmentFilter === 'regular' ? 'active' : ''}" onclick="setEnrollmentFilter('regular')"><i class="fa-solid fa-school mr-1.5"></i>Tədris ili</div>
  <div class="pill-tab ${state.studentEnrollmentFilter === 'summer' ? 'active' : ''}" onclick="setEnrollmentFilter('summer')"><i class="fa-solid fa-sun mr-1.5"></i>Yay kursu</div>
</div>
<div class="flex flex-col sm:flex-row gap-3 mb-5">
  <input id="studentSearch" class="input-style flex-1" placeholder="Axtarış: ad, soyad, telefon..." oninput="debouncedRenderStudentTable()" />
  <select id="filterClass" class="input-style sm:w-44" onchange="renderStudentTable(true)">
    <option value="">Bütün siniflər</option>
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(c => `<option value="${c}">${c}-ci sinif</option>`).join('')}
    ${Object.entries(CLASS_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
  </select>
  <select id="filterSubject" class="input-style sm:w-44" onchange="renderStudentTable(true)">
    <option value="">Bütün fənlər</option>
    ${(state.studentEnrollmentFilter === 'summer' ? state.summerSubjects : state.subjects).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
  </select>
  <button onclick="openStudentModal(null, '${state.studentEnrollmentFilter}')" class="${state.studentEnrollmentFilter === 'summer' ? 'btn-amber' : 'btn-primary'}"><i class="fa-solid fa-plus mr-2"></i>${state.studentEnrollmentFilter === 'summer' ? 'Yay kursu şagirdi' : 'Yeni Şagird'}</button>
</div>
<div class="glass rounded-3xl overflow-hidden">
  <div class="overflow-x-auto">
    <table class="responsive-table w-full text-sm">
      <thead class="bg-white/5 border-b border-white/5">
        <tr class="text-[10px] uppercase tracking-widest text-slate-400 font-black">
          <th class="text-left px-5 py-4">Ad Soyad</th>
          <th class="text-left px-5 py-4">Sinif</th>
          <th class="text-left px-5 py-4">Fənlər</th>
          ${state.profile.role === 'admin' ? '<th class="text-left px-5 py-4">Filial</th>' : ''}
          <th class="text-left px-5 py-4">Ümumi Məbləğ</th>
          <th class="text-right px-5 py-4">Əməliyyat</th>
        </tr>
      </thead>
      <tbody id="studentTableBody"></tbody>
    </table>
  </div>
  <div id="studentTablePager"></div>
</div>`;
  renderStudentTable(true);
}

function setEnrollmentFilter(type) {
  state.studentEnrollmentFilter = type;
  renderStudents();
}

// Debounced wrapper bound to the search input's oninput — waits 200ms
// after the user stops typing before rebuilding the (potentially large)
// student table, instead of rebuilding on every single keystroke. Also
// resets back to page 1, since a new search term can shrink the result
// set below whatever page the user was previously on.
const debouncedRenderStudentTable = debounce('studentSearch', () => renderStudentTable(true), 200);

const STUDENT_TABLE_PAGE_SIZE = 50;

function renderStudentTable(resetPage = false) {
  const tbody = $('studentTableBody');
  if (!tbody) return;
  if (resetPage) state.studentTablePage = 1;
  const q = ($('studentSearch')?.value || '').toLowerCase();
  const fc = $('filterClass')?.value || '';
  const fs = $('filterSubject')?.value || '';
  const rows = filterByBranch(state.students)
    .map(([id, v]) => ({ id, ...v }))
    .filter(s => studentEnrollmentType(s) === state.studentEnrollmentFilter)
    .filter(s => !q || (`${s.name || ''} ${s.surname || ''} ${s.phone1 || ''} ${s.phone2 || ''}`).toLowerCase().includes(q))
    .filter(s => !fc || String(s.class) === fc)
    .filter(s => { if (!fs) return true; return getStudentSubjects(s).some(sub => sub.subject === fs); })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Şagird tapılmadı</p></div></td></tr>`;
    renderStudentTablePager(0, 0);
    return;
  }

  // Pagination: `rows` above still computes the FULL filtered/sorted set
  // (needed for an accurate total count and for sort order to be
  // correct across page boundaries) — only the actual HTML-string build
  // below is limited to one page's worth of rows. That's the part that
  // scales badly at a few hundred+ students: building and diffing a
  // giant innerHTML string on every render, not the filtering itself.
  const totalPages = Math.max(1, Math.ceil(rows.length / STUDENT_TABLE_PAGE_SIZE));
  state.studentTablePage = Math.min(Math.max(1, state.studentTablePage || 1), totalPages);
  const startIdx = (state.studentTablePage - 1) * STUDENT_TABLE_PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + STUDENT_TABLE_PAGE_SIZE);

  tbody.innerHTML = pageRows.map(s => {
    const subs = getStudentSubjects(s);
    const totalPrice = subs.reduce((sum, sub) => sum + computeSubjectMath(sub, state.teachers[sub.teacherId]).studentPays, 0);
    const hasOverdue = subs.some(sub => isOverdue(sub.paymentDate, sub.status));
    const allPaid = subs.length > 0 && subs.every(sub => sub.status === 'paid');
    const subjectBadges = subs.map(sub => {
      const ov = isOverdue(sub.paymentDate, sub.status);
      const cls = sub.status === 'paid' ? 'badge-emerald' : ov ? 'badge-red' : 'badge-amber';
      return `<span class="badge ${cls}" style="font-size:9px;">${escapeHtml(sub.subject || '')}</span>`;
    }).join(' ');
    const statusSummary = allPaid
      ? `<span class="badge badge-emerald">Hamısı Ödənilib</span>`
      : hasOverdue
        ? `<span class="badge badge-red">Gecikmiş var</span>`
        : `<span class="badge badge-amber">Borc var</span>`;
    const enr = studentEnrollmentType(s);
    return `<tr class="border-b border-white/5 hover:bg-white/[0.02] transition">
  <td data-label="Ad Soyad" class="px-5 py-3">
    <button onclick="openStudentProfile('${s.id}')" class="font-bold text-white hover:text-emerald-400 transition text-left">${escapeHtml(s.name || '')} ${escapeHtml(s.surname || '')}</button>
    ${enr === 'summer' ? '<span class="badge badge-amber ml-2" style="font-size:9px;">YAY</span>' : ''}
    ${s.note ? `<div class="text-[10px] text-orange-400 mt-1">${escapeHtml(s.note)}</div>` : ''}
  </td>
  <td data-label="Sinif" class="px-5 py-3"><span class="badge badge-blue">${escapeHtml(classLabel(s.class))}</span></td>
  <td data-label="Fənlər" class="px-5 py-3">
    <div class="flex flex-wrap gap-1">${subjectBadges || '<span class="text-slate-500 text-xs">-</span>'}</div>
    <div class="mt-1">${statusSummary}</div>
  </td>
  ${isAdminRole() ? `<td data-label="Filial" class="px-5 py-3"><span class="badge ${s.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${BRANCH_LABEL[s.branch] || '-'}</span></td>` : ''}
  <td data-label="Məbləğ" class="px-5 py-3 font-black text-white">${fmt(totalPrice)}</td>
  <td data-label="Əməliyyat" class="px-5 py-3 text-right">
    <button onclick="openStudentProfile('${s.id}')" class="text-slate-400 hover:text-white px-2" title="Profil"><i class="fa-solid fa-eye"></i></button>
    <button onclick="openStudentModal('${s.id}')" class="text-blue-400 hover:text-blue-300 px-2" title="Redaktə"><i class="fa-solid fa-pen"></i></button>
    <button onclick="deleteStudent('${s.id}')" class="text-red-400 hover:text-red-300 px-2" title="Sil"><i class="fa-solid fa-trash"></i></button>
  </td>
</tr>`;
  }).join('');

  renderStudentTablePager(rows.length, totalPages);
}

// Renders the "Səhifə X / Y" control under the table. Kept in its own
// container (#studentTablePager, added to renderStudents()'s markup)
// rather than inside #studentTableBody so re-rendering it doesn't
// require rebuilding the actual <tbody> rows.
function renderStudentTablePager(totalRows, totalPages) {
  const el = $('studentTablePager');
  if (!el) return;
  if (totalRows === 0) { el.innerHTML = ''; return; }
  const page = state.studentTablePage;
  const from = (page - 1) * STUDENT_TABLE_PAGE_SIZE + 1;
  const to = Math.min(page * STUDENT_TABLE_PAGE_SIZE, totalRows);
  el.innerHTML = `
    <div class="flex items-center justify-between px-5 py-3 text-xs" style="color:var(--text-muted);border-top:1px solid var(--border);">
      <span>${from}–${to} / ${totalRows} şagird</span>
      <div class="flex items-center gap-1">
        <button onclick="goToStudentPage(${page - 1})" ${page <= 1 ? 'disabled' : ''} class="btn-ghost px-3 py-1.5 text-xs" aria-label="Əvvəlki səhifə"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="px-2">${page} / ${totalPages}</span>
        <button onclick="goToStudentPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''} class="btn-ghost px-3 py-1.5 text-xs" aria-label="Növbəti səhifə"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
    </div>`;
}

function goToStudentPage(page) {
  state.studentTablePage = page;
  renderStudentTable();
  // Keep the pager itself in view rather than jumping the whole page
  // back to the top of a long table.
  $('studentTablePager')?.scrollIntoView({ block: 'nearest' });
}

/* ---- Subject row builder ---- */
function buildSubjectRowHtml(idx, sub, enrollmentType) {
  const subjectList = enrollmentType === 'summer' ? state.summerSubjects : state.subjects;
  const subjectOptions = subjectList.map(s => `<option value="${escapeHtml(s)}" ${sub.subject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
  const studentBranch = $('sBranch')?.value || state.profile.branch;
  const teacherOptions = Object.entries(state.teachers)
    .filter(([_, t]) => (!sub.subject || t.subject === sub.subject) && (!studentBranch || t.branch === studentBranch))
    .map(([tid, t]) => `<option value="${tid}" ${sub.teacherId === tid ? 'selected' : ''}>${t.name} (${SALARY_TYPE_LABEL[teacherSalaryType(t)]})</option>`).join('');

  const statusOpts = ['unpaid', 'paid'].map(v => `<option value="${v}" ${(sub.status || 'unpaid') === v ? 'selected' : ''}>${v === 'paid' ? 'Ödənildi' : 'Borc'}</option>`).join('');

  let cov = sub.discountCoverage || 'course';
  const chosenTeacherId = sub.teacherId;
  const chosenTeacher = state.teachers[chosenTeacherId];
  const st = chosenTeacher ? teacherSalaryType(chosenTeacher) : 'fixed';
  const hideChips = st !== 'revenue_share';
  if (hideChips) cov = 'course';

  return `
  <div class="subject-row p-4 rounded-2xl slide-up" style="background:var(--surface-soft);border:1px solid var(--border);" data-row="${idx}">
    <div class="flex items-center justify-between mb-3">
      <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">Fənn #${idx + 1}</p>
      <button type="button" onclick="removeSubjectRow(${idx})" class="text-red-400 hover:text-red-300 text-sm w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/10">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <select class="input-style sr-subject" onchange="onSubjectRowSubjectChange(${idx})" required>
        <option value="">Fənn *</option>${subjectOptions}
      </select>
      <select class="input-style sr-teacher" required onchange="onSubjectRowTeacherChange(${idx})">
        <option value="">Müəllim seç *</option>${teacherOptions}
      </select>
    </div>
    <div class="grid grid-cols-3 gap-2 mb-2">
      <input type="text" class="input-style sr-date" placeholder="Tarix *" value="${sub.paymentDate || ''}" />
      <input type="number" class="input-style sr-price" placeholder="Qiymət (AZN)" min="0" value="${sub.price || ''}" />
      <select class="input-style sr-status">${statusOpts}</select>
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <input type="number" class="input-style sr-discount" placeholder="Güzəşt (AZN)" min="0" value="${sub.discount || ''}" />
      <input type="text" class="input-style sr-discount-note" placeholder="Güzəşt qeydi" value="${sub.discountNote || ''}" />
    </div>
    <div>
      <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Güzəşti kim qarşılayır?</p>
      <div class="chip-group sr-cov-group">
        <div class="chip ${cov === 'course' ? 'active' : ''}" data-cov="course"><i class="fa-solid fa-building mr-1"></i>Kurs</div>
        <div class="chip ${cov === 'teacher' ? 'active' : ''} ${hideChips ? 'hidden-imp' : ''}" data-cov="teacher"><i class="fa-solid fa-chalkboard-user mr-1"></i>Müəllim</div>
        <div class="chip ${cov === 'split' ? 'active' : ''} ${hideChips ? 'hidden-imp' : ''}" data-cov="split"><i class="fa-solid fa-scale-balanced mr-1"></i>50/50</div>
      </div>
      <input type="hidden" class="sr-cov" value="${cov}" />
    </div>
  </div>`;
}

function addSubjectRow(sub) {
  const container = $('subjectRowsContainer');
  const enr = $('sEnrollmentType').value;
  const idx = container.querySelectorAll('.subject-row').length;
  const newRowHtml = buildSubjectRowHtml(idx, sub || {}, enr);
  const tmp = document.createElement('div');
  tmp.innerHTML = newRowHtml;
  const rowEl = tmp.firstElementChild;
  container.appendChild(rowEl);
  flatpickr(rowEl.querySelector('.sr-date'), { locale: 'az', dateFormat: 'Y-m-d', defaultDate: sub?.paymentDate || today() });
  // wire coverage chips
  rowEl.querySelectorAll('.sr-cov-group .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      rowEl.querySelectorAll('.sr-cov-group .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      rowEl.querySelector('.sr-cov').value = chip.dataset.cov;
    });
  });
}

function removeSubjectRow(idx) {
  const container = $('subjectRowsContainer');
  const rows = container.querySelectorAll('.subject-row');
  if (rows.length <= 1) return toast('Ən azı 1 fənn olmalıdır', 'info');
  rows[idx]?.remove();
  container.querySelectorAll('.subject-row').forEach((row, i) => {
    row.dataset.row = i;
    row.querySelector('p').textContent = `Fənn #${i + 1}`;
    row.querySelector('button[type=button]').setAttribute('onclick', `removeSubjectRow(${i})`);
    row.querySelector('select.sr-subject').setAttribute('onchange', `onSubjectRowSubjectChange(${i})`);
    row.querySelector('select.sr-teacher').setAttribute('onchange', `onSubjectRowTeacherChange(${i})`);
  });
}

function onSubjectRowSubjectChange(idx) {
  const container = $('subjectRowsContainer');
  const row = container.querySelectorAll('.subject-row')[idx];
  if (!row) return;
  const sub = row.querySelector('.sr-subject').value;
  const teacherSel = row.querySelector('.sr-teacher');
  const studentBranch = $('sBranch')?.value || state.profile.branch;
  const filtered = Object.entries(state.teachers).filter(([_, t]) => (!sub || t.subject === sub) && (!studentBranch || t.branch === studentBranch));
  teacherSel.innerHTML = '<option value="">Müəllim seç *</option>' + filtered.map(([tid, t]) => `<option value="${tid}">${t.name} (${SALARY_TYPE_LABEL[teacherSalaryType(t)]})</option>`).join('');
  onSubjectRowTeacherChange(idx);
}
function refreshSubjectRowTeachers() {
  $('subjectRowsContainer').querySelectorAll('.subject-row').forEach((_, i) => onSubjectRowSubjectChange(i));
}

function onSubjectRowTeacherChange(idx) {
  const container = $('subjectRowsContainer');
  const row = container.querySelectorAll('.subject-row')[idx];
  if (!row) return;

  const teacherId = row.querySelector('.sr-teacher').value;
  const teacher = state.teachers[teacherId];
  const salaryType = teacher ? teacherSalaryType(teacher) : 'fixed';

  const teacherChip = row.querySelector('.sr-cov-group .chip[data-cov="teacher"]');
  const splitChip = row.querySelector('.sr-cov-group .chip[data-cov="split"]');
  const courseChip = row.querySelector('.sr-cov-group .chip[data-cov="course"]');
  const covInput = row.querySelector('.sr-cov');

  if (salaryType !== 'revenue_share') {
    teacherChip.classList.add('hidden-imp');
    splitChip.classList.add('hidden-imp');

    teacherChip.classList.remove('active');
    splitChip.classList.remove('active');
    courseChip.classList.add('active');
    covInput.value = 'course';
  } else {
    teacherChip.classList.remove('hidden-imp');
    splitChip.classList.remove('hidden-imp');
  }
}



function collectSubjectRows() {
  const rows = $('subjectRowsContainer').querySelectorAll('.subject-row');
  const result = [];
  let invalid = false;
  rows.forEach(row => {
    const sub = row.querySelector('.sr-subject').value;
    const teacherId = row.querySelector('.sr-teacher').value;
    if (!sub) return;
    if (!teacherId) { invalid = true; row.style.borderColor = '#ef4444'; return; }
    else row.style.borderColor = '';
    result.push({
      subject: sub,
      teacherId,
      paymentDate: row.querySelector('.sr-date').value || '',
      price: Number(row.querySelector('.sr-price').value) || 0,
      status: row.querySelector('.sr-status').value || 'unpaid',
      discount: Number(row.querySelector('.sr-discount').value) || 0,
      discountCoverage: row.querySelector('.sr-cov').value || 'course',
      discountNote: row.querySelector('.sr-discount-note').value.trim(),
    });
  });
  if (invalid) return null;
  return result;
}

/* === STUDENT WIZARD === */
function wizardGoto(step) {
  const s1 = $('wizStep1'), s2 = $('wizStep2');
  const dot1 = $('wizDot1'), dot2 = $('wizDot2'), bar = $('wizBar');
  const back = $('wizBackBtn'), next = $('wizNextBtn'), submit = $('wizSubmitBtn');
  if (step === 1) {
    s1.classList.remove('hidden'); s2.classList.add('hidden');
    dot1.classList.add('active'); dot1.classList.remove('done');
    dot2.classList.remove('active'); dot2.classList.remove('done');
    bar.style.width = '0%';
    back.classList.add('hidden');
    next.classList.remove('hidden'); submit.classList.add('hidden');
  } else {
    // validate step 1 first
    let required = ['sName', 'sSurname', 'sClass', 'sBranch'];
    if (!$('sSchoolWrap').classList.contains('hidden')) {
      required.push('sSchool');
    }
    for (const id of required) {
      const el = $(id);
      if (!el.value || (el.required && !el.value.trim?.())) {
        el.focus();
        if (typeof el.reportValidity === 'function') el.reportValidity();
        toast('Şəxsi məlumatları tamamlayın', 'error');
        return;
      }
    }
    s1.classList.add('hidden'); s2.classList.remove('hidden');
    dot1.classList.remove('active'); dot1.classList.add('done');
    dot2.classList.add('active');
    bar.style.width = '100%';
    back.classList.remove('hidden');
    next.classList.add('hidden'); submit.classList.remove('hidden');
  }
}
function wizardNext() { wizardGoto(2); }

function handleStudentClassChange() {
  const c = $('sClass').value;
  const wrap = $('sSchoolWrap');
  const input = $('sSchool');

  if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'abituriyent'].includes(c)) {
    wrap.classList.remove('hidden');
    wrap.classList.add('col-span-3'); // to span properly with grid
    input.placeholder = "Oxuduğu məktəb adını qeyd edin *";
    input.required = true;
  } else if (c === 'universitet') {
    wrap.classList.remove('hidden');
    wrap.classList.add('col-span-3');
    input.placeholder = "Oxuduğu universitetin adını qeyd edin *";
    input.required = true;
  } else if (c === 'texnikum' || c === 'pese') {
    wrap.classList.remove('hidden');
    wrap.classList.add('col-span-3');
    input.placeholder = "Oxuduğu texnikum / peşə məktəbinin adını qeyd edin *";
    input.required = true;
  } else {
    wrap.classList.add('hidden');
    input.required = false;
    input.value = '';
  }
}


function openStudentModal(id, forcedEnrollment) {
  const sb = $('sBranch');
  if (state.profile.role !== 'admin') {
    sb.innerHTML = `<option value="${state.profile.branch}">${BRANCH_LABEL[state.profile.branch]} Filialı</option>`;
    sb.disabled = true;
  } else {
    sb.innerHTML = `<option value="sheher">Şəhər Filialı</option><option value="goynuk">Göynük Filialı</option>`;
    sb.disabled = false;
  }

  const container = $('subjectRowsContainer');
  container.innerHTML = '';

  const enr = id ? studentEnrollmentType(state.students[id] || {}) : (forcedEnrollment || 'regular');
  $('sEnrollmentType').value = enr;
  $('studentModalEnrollmentBadge').className = 'badge ' + (enr === 'summer' ? 'badge-amber' : 'badge-emerald');
  $('studentModalEnrollmentBadge').textContent = enr === 'summer' ? 'YAY KURSU' : 'TƏDRİS İLİ';
  // Yay kursu üçün sadəcə 1-11 sinif
  const otherGrp = $('sClass').querySelector('optgroup[label="Digər kateqoriyalar"]');
  if (otherGrp) otherGrp.style.display = enr === 'summer' ? 'none' : '';


  if (id) {
    const s = state.students[id]; if (!s) return;
    $('studentModalTitle').textContent = 'Şagirdi Redaktə Et';
    $('sId').value = id;
    $('sName').value = s.name || ''; $('sSurname').value = s.surname || '';
    $('sParent').value = s.parent || ''; $('sClass').value = s.class || '';
    handleStudentClassChange();
    $('sSchool').value = s.school || '';
    $('sPhone1').value = s.phone1 || ''; $('sPhone2').value = s.phone2 || '';
    $('sBranch').value = s.branch || state.profile.branch;
    $('sNote').value = s.note || '';
    const subs = getStudentSubjects(s);
    subs.forEach(sub => addSubjectRow(sub));
    if (subs.length === 0) addSubjectRow();
  } else {
    $('studentModalTitle').textContent = enr === 'summer' ? 'Yeni Yay Kursu Şagirdi' : 'Yeni Şagird';
    $('studentForm').reset();
    handleStudentClassChange();
    $('sEnrollmentType').value = enr;
    $('sId').value = '';
    $('sBranch').value = state.profile.role === 'admin' ? 'sheher' : state.profile.branch;
    addSubjectRow();
  }
  wizardGoto(1);
  openModal('studentModal');
}

$('studentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('sId').value;
  if (id && !can('students.edit')) return toast('Redaktə icazəniz yoxdur', 'error');
  if (!id && !can('students.add')) return toast('Əlavə etmə icazəniz yoxdur', 'error');
  const subjects = collectSubjectRows();
  if (subjects === null) return toast('Hər fənn üçün müəllim seçilməlidir', 'error');
  if (subjects.length === 0) return toast('Ən azı 1 fənn əlavə edin', 'error');
  const data = {
    name: $('sName').value.trim(),
    surname: $('sSurname').value.trim(),
    parent: $('sParent').value.trim(),
    class: $('sClass').value,
    school: $('sSchool').value.trim() || null,
    phone1: $('sPhone1').value.trim(),
    phone2: $('sPhone2').value.trim(),
    branch: $('sBranch').value,
    note: $('sNote').value.trim(),
    enrollmentType: $('sEnrollmentType').value || 'regular',
    subjects,
    subject: null, teacherId: null, paymentDate: null, price: null, status: null,
    updatedAt: Date.now(),
    updatedBy: state.user.uid,
  };
  try {
    if (id) {
      await db.ref('students/' + id).update(data);
      await logAudit('update', 'student', id, `${data.name} ${data.surname}`);
      toast('Şagird yeniləndi');
    } else {
      data.createdAt = Date.now();
      data.createdBy = state.user.uid;
      const ref = await db.ref('students').push(data);
      await logAudit('create', 'student', ref.key, `${data.name} ${data.surname}`);
      toast('Şagird əlavə edildi');
    }
    closeModal('studentModal');
  } catch (err) { toast('Xəta: ' + err.message, 'error'); }
});

async function toggleSubjectPaid(studentId, subIdx) {
  const s = state.students[studentId]; if (!s) return;
  if (!can('finance.edit')) return toast('İcazə yoxdur', 'error');
  if (!canEdit(s)) return toast('İcazə yoxdur', 'error');
  const subs = getStudentSubjects(s).map(x => ({ ...x }));
  if (!subs[subIdx]) return;
  subs[subIdx].status = subs[subIdx].status === 'paid' ? 'unpaid' : 'paid';
  await db.ref('students/' + studentId).update({ subjects: subs });
  await logAudit('payment_toggle', 'student', studentId, `${s.name} ${s.surname} · ${subs[subIdx].subject} → ${subs[subIdx].status}`);
  toast(subs[subIdx].status === 'paid' ? 'Ödənildi qeyd edildi' : 'Borc kimi qeyd edildi', 'info');
  openStudentProfile(studentId);
}

function deleteStudent(id) {
  const s = state.students[id]; if (!s) return;
  if (!can('students.delete')) return toast('İcazə yoxdur', 'error');
  if (!canEdit(s)) return toast('İcazə yoxdur', 'error');
  confirmAction('Şagirdi silmək?', `${s.name} ${s.surname} silinəcək.`, async () => {
    try {
      await db.ref('students/' + id).remove();
      await db.ref('examResults/' + id).remove();
      await logAudit('delete', 'student', id, `${s.name} ${s.surname}`);
      toast('Silindi', 'info');
    } catch (err) { toast('Xəta: ' + err.message, 'error'); }
  });
}

/* ---- Student profile ---- */
function openStudentProfile(id) {
  const s = state.students[id]; if (!s) return;
  state.currentProfileId = id;
  state.profileTab = 'subjects';
  $('profileAvatar').textContent = (s.name || 'A').charAt(0).toUpperCase();
  $('profileName').textContent = `${s.name || ''} ${s.surname || ''}`;
  $('profileClass').textContent = classLabel(s.class);
  $('profileBranch').textContent = BRANCH_LABEL[s.branch] || '-';
  $('profilePhone1').textContent = s.phone1 || '-';
  $('profilePhone2').textContent = s.phone2 || '-';
  $('profileParent').textContent = s.parent ? `Valideyn: ${s.parent}` : '';
  $('profileSchool').innerHTML = s.school ? `<i class="fa-solid fa-school mr-1.5 opacity-70"></i>${escapeHtml(s.school)}` : '';

  const subs = getStudentSubjects(s);
  const allPaid = subs.length > 0 && subs.every(sub => sub.status === 'paid');
  const hasOverdue = subs.some(sub => isOverdue(sub.paymentDate, sub.status));
  const enr = studentEnrollmentType(s);
  $('profileBadges').innerHTML =
    `<span class="badge ${s.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${BRANCH_LABEL[s.branch] || ''}</span>` +
    `<span class="badge badge-blue">${escapeHtml(classLabel(s.class))}</span>` +
    `<span class="badge ${enr === 'summer' ? 'badge-amber' : 'badge-emerald'}">${enr === 'summer' ? 'YAY KURSU' : 'TƏDRİS İLİ'}</span>` +
    (allPaid ? `<span class="badge badge-emerald">Ödənilib</span>` :
      hasOverdue ? `<span class="badge badge-red">Gecikmiş Borc</span>` :
        `<span class="badge badge-amber">Borc var</span>`);

  renderProfileSubjects();
  renderProfilePayments();
  setProfileTab('subjects');

  if (s.note) { $('profileNote').classList.remove('hidden'); $('profileNoteText').textContent = s.note; }
  else $('profileNote').classList.add('hidden');

  $('profileEditBtn').setAttribute('onclick', `closeModal('studentProfileModal');openStudentModal('${id}')`);
  openModal('studentProfileModal');
}

function setProfileTab(tab) {
  state.profileTab = tab;
  document.querySelectorAll('[data-ptab]').forEach(b => b.classList.toggle('active', b.dataset.ptab === tab));
  ['Subjects', 'Exams', 'Payments'].forEach(t => {
    $('profileTab' + t).classList.toggle('hidden', tab !== t.toLowerCase());
  });
  if (tab === 'exams') renderProfileExams();
}

function renderProfileSubjects() {
  const id = state.currentProfileId;
  const s = state.students[id]; if (!s) return;
  const subs = getStudentSubjects(s);
  const profSubs = $('profileSubjectsList');
  let totalGross = 0, totalDiscount = 0, totalStudentPays = 0, totalUnpaid = 0;
  if (subs.length === 0) {
    profSubs.innerHTML = `<p class="text-slate-500 text-sm text-center py-6">Fənn qeyd edilməyib</p>`;
  } else {
    profSubs.innerHTML = subs.map((sub, idx) => {
      const teacher = sub.teacherId ? state.teachers[sub.teacherId] : null;
      const math = computeSubjectMath(sub, teacher);
      totalGross += math.gross; totalDiscount += math.discount; totalStudentPays += math.studentPays;
      if (sub.status !== 'paid') totalUnpaid += math.studentPays;
      const ov = isOverdue(sub.paymentDate, sub.status);
      const statusCls = sub.status === 'paid' ? 'badge-emerald' : ov ? 'badge-red' : 'badge-amber';
      const statusLbl = sub.status === 'paid' ? 'ÖDƏNİLİB' : ov ? 'GECİKMƏ' : 'BORC';
      const covLbl = { course: 'Kurs', teacher: 'Müəllim', split: '50/50' }[math.coverage] || 'Kurs';
      return `
      <div class="p-4 rounded-2xl slide-up" style="background:var(--surface-soft);border:1px solid var(--border);">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <p class="font-black text-white">${sub.subject || ''}</p>
            <p class="text-xs text-slate-400 mt-0.5">${teacher ? '<i class="fa-solid fa-chalkboard-user mr-1"></i>' + teacher.name + ' · ' + SALARY_TYPE_LABEL[teacherSalaryType(teacher)] : '<span class="text-slate-600">Müəllim təyin edilməyib</span>'}</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-right">
              <p class="font-black text-white">${fmt(math.studentPays)}</p>
              <p class="text-[10px] text-slate-500">${sub.paymentDate || '-'}</p>
            </div>
            <span class="badge ${statusCls}">${statusLbl}</span>
            <button onclick="toggleSubjectPaid('${id}', ${idx})" class="w-8 h-8 rounded-full flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition" title="Statusu dəyiş">
              <i class="fa-solid fa-money-bill-wave text-sm"></i>
            </button>
          </div>
        </div>
        ${math.discount > 0 ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mt-2 pt-2 border-t border-white/5">
          <div><span class="text-slate-500">Əsl qiymət:</span> <span class="text-white font-bold">${fmt(math.gross)}</span></div>
          <div><span class="text-slate-500">Güzəşt:</span> <span class="text-orange-400 font-bold">−${fmt(math.discount)}</span></div>
          <div><span class="text-slate-500">Qarşılayır:</span> <span class="badge badge-purple" style="font-size:8px;">${covLbl}</span></div>
          ${sub.discountNote ? `<div class="col-span-2 sm:col-span-1"><span class="text-orange-300">${sub.discountNote}</span></div>` : ''}
        </div>` : ''}
      </div>`;
    }).join('');
  }

  $('profileDebtSummary').innerHTML = `
    <div class="grid grid-cols-3 gap-3 p-4 rounded-2xl" style="background:var(--teal-50);border:1px solid var(--teal-100)">
      <div class="text-center"><p class="text-[10px] text-slate-500 uppercase font-bold">Ödənilməli</p><p class="text-lg font-black text-emerald-400">${fmt(totalStudentPays)}</p></div>
      <div class="text-center"><p class="text-[10px] text-slate-500 uppercase font-bold">Güzəşt</p><p class="text-lg font-black text-orange-400">${fmt(totalDiscount)}</p></div>
      <div class="text-center"><p class="text-[10px] text-slate-500 uppercase font-bold">Qalıq borc</p><p class="text-lg font-black ${totalUnpaid > 0 ? 'text-red-400' : 'text-emerald-400'}">${fmt(totalUnpaid)}</p></div>
    </div>`;
}

function renderProfilePayments() {
  const id = state.currentProfileId;
  const s = state.students[id]; if (!s) return;
  const subs = getStudentSubjects(s);
  const sorted = [...subs].sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
  $('profilePaymentsList').innerHTML = sorted.length === 0
    ? `<p class="text-slate-500 text-sm text-center py-6">Ödəniş qeydi yoxdur</p>`
    : sorted.map(sub => {
      const math = computeSubjectMath(sub, state.teachers[sub.teacherId]);
      const ov = isOverdue(sub.paymentDate, sub.status);
      const cls = sub.status === 'paid' ? 'badge-emerald' : ov ? 'badge-red' : 'badge-amber';
      const lbl = sub.status === 'paid' ? 'ÖDƏNİLİB' : ov ? 'GECİKMƏ' : 'BORC';
      return `<div class="flex items-center justify-between p-3 rounded-xl glass-soft">
        <div><p class="text-sm font-bold text-white">${escapeHtml(sub.subject || '')}</p><p class="text-[10px] text-slate-500">${sub.paymentDate || '-'}</p></div>
        <div class="flex items-center gap-2"><span class="text-sm font-black text-white">${fmt(math.studentPays)}</span><span class="badge ${cls}">${lbl}</span></div>
      </div>`;
    }).join('');
}

function renderProfileExams() {
  const id = state.currentProfileId;
  const results = state.examResults[id] || {};
  const list = Object.entries(results).map(([rid, r]) => ({ id: rid, ...r })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const wrap = $('examResultsList');
  if (list.length === 0) {
    wrap.innerHTML = `<p class="text-slate-500 text-sm text-center py-6">İmtahan nəticəsi yoxdur</p>`;
  } else {
    wrap.innerHTML = list.map(r => {
      const pct = r.totalMax ? Math.round((Number(r.totalScore) || 0) / Number(r.totalMax) * 100) : null;
      const subjLine = (r.subjects || []).map(s => `<span class="badge badge-slate" style="font-size:9px;">${escapeHtml(s.subject || '')}: ${s.score}/${s.max}</span>`).join(' ');
      return `
      <div class="p-4 rounded-2xl slide-up" style="background:var(--plum-50);border:1px solid var(--plum-100);">
        <div class="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p class="font-black text-white">${escapeHtml(r.examName || '')}</p>
            <p class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">${escapeHtml(r.date || '')} ${r.rank ? '· Yer: ' + escapeHtml(r.rank) : ''}</p>
          </div>
          <div class="text-right">
            <p class="text-xl font-black text-purple-400">${r.totalScore || 0}${r.totalMax ? '/' + r.totalMax : ''}</p>
            ${pct !== null ? `<p class="text-[10px] font-bold ${pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}">${pct}%</p>` : ''}
          </div>
        </div>
        ${subjLine ? `<div class="flex flex-wrap gap-1 mt-2">${subjLine}</div>` : ''}
        ${r.note ? `<p class="text-[11px] text-slate-400 mt-2">${escapeHtml(r.note)}</p>` : ''}
        <div class="flex justify-end gap-2 mt-2">
          ${can('exams.view') ? `<button onclick="openExamModal('${r.id}')" class="text-blue-400 hover:text-blue-300 text-xs px-2"><i class="fa-solid fa-pen"></i></button>` : ''}
          ${can('exams.delete') ? `<button onclick="deleteExam('${r.id}')" class="text-red-400 hover:text-red-300 text-xs px-2"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  drawExamTrend(list);
}

function drawExamTrend(list) {
  const ctx = $('examTrendChart');
  if (!ctx) return;
  if (state.charts.exam) state.charts.exam.destroy();
  const sorted = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const labels = sorted.map(r => r.date || '');
  const data = sorted.map(r => r.totalMax ? Math.round((Number(r.totalScore) || 0) / Number(r.totalMax) * 100) : (Number(r.totalScore) || 0));
  const isDark = document.documentElement.classList.contains('dark-mode');
  state.charts.exam = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Nəticə (%)', data, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', tension: .35, fill: true, pointRadius: 4, pointBackgroundColor: '#7c3aed' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: isDark ? '#a6b0ac' : '#5b6b67', font: { weight: 'bold', size: 10 } } } },
      scales: {
        x: { ticks: { color: '#7c8a86', font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: '#7c8a86', font: { size: 10 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,30,28,0.06)' }, beginAtZero: true }
      }
    }
  });
}

/* ---- Exam modal ---- */
function openExamModal(rid) {
  const sid = state.currentProfileId;
  if (!sid) return;
  $('exStudentId').value = sid;
  $('examSubjectRows').innerHTML = '';
  if (rid) {
    const r = (state.examResults[sid] || {})[rid]; if (!r) return;
    $('examModalTitle').textContent = 'Nəticəni Redaktə Et';
    $('exId').value = rid;
    $('exDate').value = r.date || ''; $('exName').value = r.examName || '';
    $('exTotalScore').value = r.totalScore || ''; $('exTotalMax').value = r.totalMax || '';
    $('exRank').value = r.rank || ''; $('exNote').value = r.note || '';
    (r.subjects || []).forEach(s => addExamSubjectRow(s));
    if (!(r.subjects || []).length) addExamSubjectRow();
  } else {
    $('examModalTitle').textContent = 'Yeni İmtahan Nəticəsi';
    $('examForm').reset(); $('exId').value = ''; $('exStudentId').value = sid;
    $('exDate').value = today();
    addExamSubjectRow();
  }
  flatpickr('#exDate', { locale: 'az', dateFormat: 'Y-m-d', defaultDate: $('exDate').value || today() });
  openModal('examModal');
}

function addExamSubjectRow(s) {
  const c = $('examSubjectRows');
  const idx = c.children.length;
  const subjList = state.subjects.concat(state.summerSubjects);
  const row = document.createElement('div');
  row.className = 'exr grid grid-cols-12 gap-2';
  row.innerHTML = `
    <select class="input-style col-span-6 exr-subject">${subjList.map(x => `<option value="${escapeHtml(x)}" ${s?.subject === x ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('')}</select>
    <input type="number" class="input-style col-span-2 exr-score" placeholder="Bal" step="0.01" min="0" value="${s?.score ?? ''}" />
    <input type="number" class="input-style col-span-2 exr-max" placeholder="Max" step="0.01" min="0" value="${s?.max ?? ''}" />
    <button type="button" class="col-span-2 btn-ghost text-red-400" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
  c.appendChild(row);
}

$('examForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sid = $('exStudentId').value;
  const rid = $('exId').value;
  const subjects = [...document.querySelectorAll('#examSubjectRows .exr')].map(r => ({
    subject: r.querySelector('.exr-subject').value,
    score: Number(r.querySelector('.exr-score').value) || 0,
    max: Number(r.querySelector('.exr-max').value) || 0,
  })).filter(x => x.subject);
  const data = {
    date: $('exDate').value, examName: $('exName').value.trim(),
    totalScore: Number($('exTotalScore').value) || 0,
    totalMax: Number($('exTotalMax').value) || 0,
    rank: $('exRank').value.trim(), note: $('exNote').value.trim(),
    subjects, updatedAt: Date.now()
  };
  try {
    if (rid) {
      await db.ref('examResults/' + sid + '/' + rid).update(data);
      await logAudit('update', 'exam', rid, `${data.examName} (${data.date})`);
      toast('İmtahan nəticəsi yeniləndi');
    } else {
      data.createdAt = Date.now(); data.createdBy = state.user.uid;
      const ref = await db.ref('examResults/' + sid).push(data);
      await logAudit('create', 'exam', ref.key, `${data.examName} (${data.date})`);
      toast('Nəticə əlavə edildi');
    }
    closeModal('examModal');
    renderProfileExams();
  } catch (err) { toast('Xəta: ' + err.message, 'error'); }
});

function deleteExam(rid) {
  const sid = state.currentProfileId;
  if (!can('exams.delete')) return toast('İcazəniz yoxdur', 'error');
  confirmAction('Nəticəni silmək?', '', async () => {
    await db.ref('examResults/' + sid + '/' + rid).remove();
    await logAudit('delete', 'exam', rid, '');
    toast('Silindi', 'info');
    renderProfileExams();
  });
}

function printExamResults() {
  const sid = state.currentProfileId;
  const s = state.students[sid]; if (!s) return;
  const results = state.examResults[sid] || {};
  const list = Object.values(results).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const w = window.open('', '_blank', 'width=900,height=700');
  const rows = list.map(r => `<tr><td>${escapeHtml(r.date || '')}</td><td>${escapeHtml(r.examName || '')}</td><td>${escapeHtml(String(r.totalScore || 0))}${r.totalMax ? '/' + escapeHtml(String(r.totalMax)) : ''}</td><td>${escapeHtml(r.rank || '')}</td><td>${(r.subjects || []).map(x => `${escapeHtml(x.subject)}: ${escapeHtml(String(x.score))}/${escapeHtml(String(x.max))}`).join(', ')}</td><td>${escapeHtml(r.note || '')}</td></tr>`).join('');
  w.document.write(`<html><head><title>İmtahan nəticələri — ${escapeHtml(s.name)} ${escapeHtml(s.surname)}</title>
    <style>
    body{font-family:'Inter',Arial,sans-serif;padding:32px;color:#0f1e1c;background:#fbf7f0}
    h1{font-family:'Space Grotesk',Arial,sans-serif;margin:0;font-size:22px}
    h2{margin:6px 0 0;color:#5b6b67;font-weight:500;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-top:20px;background:#fff;border-radius:8px;overflow:hidden}
    th,td{border-bottom:1px solid #ede4d2;padding:10px;font-size:13px;text-align:left}
    th{background:#f5efe3;color:#5b6b67;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    </style></head>
    <body><h1>${escapeHtml(s.name)} ${escapeHtml(s.surname)}</h1><h2>${escapeHtml(classLabel(s.class))} · ${escapeHtml(BRANCH_LABEL[s.branch] || '')} filialı</h2>
    <table><thead><tr><th>Tarix</th><th>İmtahan</th><th>Bal</th><th>Yer</th><th>Fənlər</th><th>Qeyd</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:30px;font-size:11px;color:#a6b0ac">Çap tarixi: ${new Date().toLocaleString('az-AZ')} · Məram Tədris Mərkəzi</p>
    </body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

