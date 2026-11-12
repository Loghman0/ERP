/* ================= FINANCE ================= */
let financeTab = 'report';
let financeEnrollment = 'all'; // all | regular | summer
function renderFinance() {
  const v = $('view-finance');
  v.innerHTML = `
<div class="flex flex-wrap gap-6 border-b border-white/5 mb-6">
  <button class="tab-btn ${financeTab === 'report' ? 'active' : ''}" onclick="financeTab='report';renderFinance()"><i class="fa-solid fa-chart-pie mr-2"></i>Hesabat</button>
  <button class="tab-btn ${financeTab === 'salaries' ? 'active' : ''}" onclick="financeTab='salaries';renderFinance()"><i class="fa-solid fa-money-check-dollar mr-2"></i>Müəllim Maaşları</button>
  <button class="tab-btn ${financeTab === 'income' ? 'active' : ''}" onclick="financeTab='income';renderFinance()"><i class="fa-solid fa-arrow-down mr-2"></i>Gəlirlər</button>
  <button class="tab-btn ${financeTab === 'expenses' ? 'active' : ''}" onclick="financeTab='expenses';renderFinance()"><i class="fa-solid fa-arrow-up mr-2"></i>Xərclər</button>
</div>
<div id="financeContent"></div>
  `;
  if (financeTab === 'report') renderFinanceReport();
  if (financeTab === 'salaries') renderTeacherSalaries();
  if (financeTab === 'income') renderFinanceList('income');
  if (financeTab === 'expenses') renderFinanceList('expenses');
}

function financeMonth() { return $('finMonth')?.value || monthKey(today()); }

function computeFinance(monthFilter, enrollmentFilter) {
  const incomeRecs = filterByBranch(state.income).map(([id, v]) => ({ id, ...v }));
  const expenseRecs = filterByBranch(state.expenses).map(([id, v]) => ({ id, ...v }));
  const studentRecs = filterByBranch(state.students).map(([id, v]) => ({ id, ...v }))
    .filter(s => !enrollmentFilter || enrollmentFilter === 'all' || studentEnrollmentType(s) === enrollmentFilter);

  const inMonth = (d) => !monthFilter || (d && monthKey(d) === monthFilter);

  let tuition = 0, courseShare = 0, teacherShareTotal = 0;
  studentRecs.forEach(s => {
    getStudentSubjects(s).forEach(sub => {
      if (sub.status !== 'paid' || !inMonth(sub.paymentDate)) return;
      const teacher = state.teachers[sub.teacherId];
      const m = computeSubjectMath(sub, teacher);
      tuition += m.studentPays;
      courseShare += m.courseEarn || m.studentPays;
      teacherShareTotal += m.teacherEarn || 0;
    });
  });

  const manualIncome = incomeRecs.filter(i => inMonth(i.date)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalIncome = tuition + manualIncome;

  // Auto teacher salaries
  const teachers = filterByBranch(state.teachers).map(([id, t]) => ({ id, ...t }));
  let autoSalaries = 0;
  const salaryDetails = teachers.map(t => {
    const role = staffRole(t);
    const st = teacherSalaryType(t);
    let amount = 0, normalEarn = 0, discountedEarn = 0, discountedCount = 0, normalCount = 0;
    if (role !== 'teacher') {
      amount = Number(t.fixedSalary ?? t.salary) || 0;
      autoSalaries += amount;
      return { id: t.id, name: t.name, type: 'fixed', amount, branch: t.branch, normalEarn: 0, discountedEarn: 0, discountedCount: 0, normalCount: 0, role };
    }
    if (st === 'fixed') amount = Number(t.monthlySalary ?? t.salary) || 0;
    else if (st === 'hourly') amount = (Number(t.hourlyRate) || 0) * ((t.hours || {})[monthFilter] || 0);
    else {
      // revenue_share: ayır - güzəştsiz vs güzəştli şagirdlər
      studentRecs.forEach(s => {
        getStudentSubjects(s).forEach(sub => {
          if (sub.teacherId === t.id && sub.status === 'paid' && inMonth(sub.paymentDate)) {
            const m = computeSubjectMath(sub, t);
            amount += m.teacherEarn || 0;
            if ((Number(sub.discount) || 0) > 0) { discountedEarn += m.teacherEarn || 0; discountedCount++; }
            else { normalEarn += m.teacherEarn || 0; normalCount++; }
          }
        });
      });
    }
    autoSalaries += amount;
    return { id: t.id, name: t.name, type: st, amount, branch: t.branch, normalEarn, discountedEarn, discountedCount, normalCount, role: 'teacher' };
  });


  const manualExpense = expenseRecs.filter(e => inMonth(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExpense = manualExpense + autoSalaries;

  const byCat = { salary_auto: autoSalaries };
  expenseRecs.filter(e => inMonth(e.date)).forEach(e => { byCat[e.category || 'other'] = (byCat[e.category || 'other'] || 0) + (Number(e.amount) || 0); });
  const expenseTitles = expenseRecs.filter(e => inMonth(e.date)).map(e => (e.title || '').trim()).filter(Boolean);

  return { tuition, manualIncome, totalIncome, manualExpense, autoSalaries, totalExpense, net: totalIncome - totalExpense, byCat, salaryDetails, courseShare, teacherShareTotal, expenseTitles };
}


function renderFinanceReport() {
  const m = financeMonth();
  const r = computeFinance(m, financeEnrollment);
  $('financeContent').innerHTML = `
<div class="flex flex-wrap gap-3 mb-5">
  <input id="finMonth" type="month" value="${m}" class="input-style sm:w-48" onchange="renderFinanceReport()"/>
  <div class="flex items-center gap-1 p-1 glass-soft rounded-xl">
    <button class="pill-tab ${financeEnrollment === 'all' ? 'active' : ''}" onclick="financeEnrollment='all';renderFinanceReport()">Hamısı</button>
    <button class="pill-tab ${financeEnrollment === 'regular' ? 'active' : ''}" onclick="financeEnrollment='regular';renderFinanceReport()">Tədris ili</button>
    <button class="pill-tab ${financeEnrollment === 'summer' ? 'active' : ''}" onclick="financeEnrollment='summer';renderFinanceReport()">Yay kursu</button>
  </div>
</div>
<div class="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-6">
  <div class="stat-card bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20">
    <i class="fa-solid fa-arrow-down stat-icon text-emerald-400"></i>
    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Ümumi Gəlir</p>
    <p class="text-2xl font-black text-emerald-400 mt-2">${fmt(r.totalIncome)}</p>
    <p class="text-[10px] text-slate-500 mt-2">Təlim: ${fmt(r.tuition)} · Digər: ${fmt(r.manualIncome)}</p>
  </div>
  <div class="stat-card bg-gradient-to-br from-red-500/15 to-red-500/5 border border-red-500/20">
    <i class="fa-solid fa-arrow-up stat-icon text-red-400"></i>
    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Ümumi Xərc</p>
    <p class="text-2xl font-black text-red-400 mt-2">${fmt(r.totalExpense)}</p>
    <p class="text-[10px] text-slate-500 mt-2">Maaş: ${fmt(r.autoSalaries)} · Digər: ${fmt(r.manualExpense)}</p>
    ${r.expenseTitles.length ? `<p class="text-[10px] text-slate-400 mt-2 lowercase italic leading-relaxed">${r.expenseTitles.map(t => t.toLowerCase()).join(', ')}</p>` : ''}
  </div>

  <div class="stat-card bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/20">
    <i class="fa-solid fa-chalkboard-user stat-icon text-purple-400"></i>
    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Müəllim payı</p>
    <p class="text-2xl font-black text-purple-400 mt-2">${fmt(r.teacherShareTotal)}</p>
    <p class="text-[10px] text-slate-500 mt-2">Kurs payı: ${fmt(r.courseShare)}</p>
  </div>
  <div class="stat-card bg-gradient-to-br ${r.net >= 0 ? 'from-blue-500/15 to-blue-500/5 border-blue-500/20' : 'from-red-500/15 to-red-500/5 border-red-500/20'} border">
    <i class="fa-solid fa-sack-dollar stat-icon ${r.net >= 0 ? 'text-blue-400' : 'text-red-400'}"></i>
    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Mənfəət</p>
    <p class="text-2xl font-black ${r.net >= 0 ? 'text-blue-400' : 'text-red-400'} mt-2">${fmt(r.net)}</p>
  </div>
</div>
<div class="glass rounded-3xl p-5 sm:p-6">
  <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);">Kateqoriyalar üzrə Xərc</h3>
  <div style="height:300px;"><canvas id="chartExpenseCat"></canvas></div>
</div>
  `;
  if (state.charts.cat) state.charts.cat.destroy();
  const labels = Object.keys(r.byCat);
  const catLabel = { salary_auto: "Avto Maaşlar", salary: "Maaş (əl ilə)", rent: "İcarə", utility: "Kommunal", marketing: "Marketinq", other: "Digər" };
  const isDark = document.documentElement.classList.contains('dark-mode');
  state.charts.cat = new Chart($('chartExpenseCat'), {
    type: 'doughnut',
    data: { labels: labels.map(l => catLabel[l] || l), datasets: [{ data: labels.map(l => r.byCat[l]), backgroundColor: ['#7c3aed', '#2563eb', '#0d9488', '#d97706', '#dc2626', '#c2410c'], borderColor: isDark ? '#142522' : '#ffffff', borderWidth: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#a6b0ac' : '#5b6b67', font: { weight: 'bold', size: 11 }, padding: 14 } } } }
  });
}

function renderTeacherSalaries() {
  const m = financeMonth() || monthKey(today());
  const r = computeFinance(m, financeEnrollment);
  $('financeContent').innerHTML = `
<div class="flex flex-wrap gap-3 mb-5">
  <input id="finMonth" type="month" value="${m}" class="input-style sm:w-48" onchange="renderTeacherSalaries()"/>
  <div class="ml-auto text-right">
    <p class="text-[10px] uppercase text-slate-500 font-bold">${m} ayı üçün toplam maaş</p>
    <p class="text-2xl font-black text-purple-400">${fmt(r.autoSalaries)}</p>
  </div>
</div>
<div class="glass rounded-3xl overflow-hidden">
  <table class="responsive-table w-full text-sm">
    <thead class="bg-white/5 border-b border-white/5">
      <tr class="text-[10px] uppercase tracking-widest text-slate-400 font-black">
        <th class="text-left px-5 py-4">Ad</th>
        <th class="text-left px-5 py-4">Vəzifə</th>
        <th class="text-left px-5 py-4">Tip</th>
        <th class="text-left px-5 py-4">Filial</th>
        <th class="text-left px-5 py-4">Bölgü</th>
        <th class="text-right px-5 py-4">Maaş</th>
      </tr>
    </thead>
    <tbody>
      ${r.salaryDetails.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Kadr yoxdur</p></div></td></tr>` :
      r.salaryDetails.map(t => `<tr class="border-b border-white/5">
          <td data-label="Ad" class="px-5 py-3 font-bold text-white">${escapeHtml(t.name)}</td>
          <td data-label="Vəzifə" class="px-5 py-3"><span class="badge ${STAFF_ROLE_BADGE[t.role || 'teacher']}">${STAFF_ROLE_LABEL[t.role || 'teacher']}</span></td>
          <td data-label="Tip" class="px-5 py-3"><span class="badge badge-purple">${SALARY_TYPE_LABEL[t.type]}</span></td>
          <td data-label="Filial" class="px-5 py-3"><span class="badge ${t.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${BRANCH_LABEL[t.branch]}</span></td>
          <td data-label="Bölgü" class="px-5 py-3 text-[11px] text-slate-400">
            ${t.type === 'revenue_share' ? `<div>Adi (${t.normalCount}): <span class="text-emerald-400 font-bold">${fmt(t.normalEarn)}</span></div>
               <div>Güzəştli (${t.discountedCount}): <span class="text-orange-300 font-bold">${fmt(t.discountedEarn)}</span></div>` : '<span class="text-slate-600">—</span>'}
          </td>
          <td data-label="Maaş" class="px-5 py-3 text-right font-black text-emerald-400">${fmt(t.amount)}</td>
        </tr>`).join('')}
    </tbody>
  </table>
</div>
<p class="text-[11px] text-slate-500 mt-4"><i class="fa-solid fa-circle-info mr-1"></i>Şagird %-i müəllimlərində <b>güzəştli şagirdlər ayrıca hesablanır</b>: güzəşt "kim qarşılayır" seçiminə görə müvafiq tərəfdən tutulur, qalanı isə bölünür. Sabit/Saatlıq müəllimlərin maaşına güzəşt təsir etmir.</p>

  `;
}

function renderFinanceList(type) {
  const recs = filterByBranch(state[type]).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const isExp = type === 'expenses';
  const catLabel = { salary: "Müəllim Maaşı", rent: "İcarə", utility: "Kommunal", marketing: "Marketinq", other: "Digər" };
  $('financeContent').innerHTML = `
<div class="flex justify-end mb-5">
  <button onclick="openFinanceModal('${type}')" class="${isExp ? 'btn-danger' : 'btn-primary'}"><i class="fa-solid fa-plus mr-2"></i>Yeni ${isExp ? 'Xərc' : 'Gəlir'}</button>
</div>
<div class="glass rounded-3xl overflow-hidden">
  <div class="overflow-x-auto">
    <table class="responsive-table w-full text-sm">
      <thead class="bg-white/5 border-b border-white/5">
        <tr class="text-[10px] uppercase tracking-widest text-slate-400 font-black">
          <th class="text-left px-5 py-4">Başlıq</th>
          ${isExp ? '<th class="text-left px-5 py-4">Kateqoriya</th>' : ''}
          <th class="text-left px-5 py-4">Tarix</th>
          ${isAdminRole() ? `<th class="text-left px-5 py-4">Filial</th>` : ''}
          <th class="text-left px-5 py-4">Məbləğ</th>
          <th class="text-right px-5 py-4">Əməliyyat</th>
        </tr>
      </thead>
      <tbody>
        ${recs.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Qeyd yoxdur</p></div></td></tr>` :
      recs.map(r => `
            <tr class="border-b border-white/5 hover:bg-white/[0.02]">
              <td data-label="Başlıq" class="px-5 py-3 font-bold text-white">${escapeHtml(r.title || '-')}${r.note ? `<div class="text-[10px] text-slate-500 mt-1">${escapeHtml(r.note)}</div>` : ''}</td>
              ${isExp ? `<td data-label="Kateqoriya" class="px-5 py-3"><span class="badge badge-slate">${escapeHtml(catLabel[r.category] || r.category || '-')}</span></td>` : ''}
              <td data-label="Tarix" class="px-5 py-3 text-slate-400 text-xs">${escapeHtml(r.date || '-')}</td>
              ${isAdminRole() ? `<td data-label="Filial" class="px-5 py-3"><span class="badge ${r.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${escapeHtml(BRANCH_LABEL[r.branch] || '-')}</span></td>` : ''}
              <td data-label="Məbləğ" class="px-5 py-3 font-black ${isExp ? 'text-red-400' : 'text-emerald-400'}">${fmt(r.amount)}</td>
              <td data-label="Əməliyyat" class="px-5 py-3 text-right">
                ${can('finance.edit') ? `<button onclick="openFinanceModal('${type}','${r.id}')" class="text-blue-400 px-2"><i class="fa-solid fa-pen"></i></button>` : ''}
                ${can('finance.delete') ? `<button onclick="deleteFinance('${type}','${r.id}')" class="text-red-400 px-2"><i class="fa-solid fa-trash"></i></button>` : ''}
              </td>
            </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>
  `;
}

function openFinanceModal(type, id) {
  $('fType').value = type;
  const isExp = type === 'expenses';
  $('financeModalTitle').textContent = (id ? 'Redaktə: ' : 'Yeni ') + (isExp ? 'Xərc' : 'Gəlir');
  $('fCategoryWrap').style.display = isExp ? 'block' : 'none';
  const fb = $('fBranch');
  if (!isAdminRole()) {
    fb.innerHTML = `<option value="${state.profile.branch}">${BRANCH_LABEL[state.profile.branch]} Filialı</option>`;
    fb.disabled = true;
  } else {
    fb.innerHTML = `<option value="sheher">Şəhər Filialı</option><option value="goynuk">Göynük Filialı</option>`;
    fb.disabled = false;
  }
  if (id) {
    const r = state[type][id]; if (!r) return;
    $('fId').value = id; $('fTitle').value = r.title || ''; $('fAmount').value = r.amount || '';
    $('fDate').value = r.date || ''; $('fCategory').value = r.category || 'other';
    $('fBranch').value = r.branch || state.profile.branch; $('fNote').value = r.note || '';
  } else {
    $('financeForm').reset(); $('fId').value = ''; $('fType').value = type;
    $('fBranch').value = state.profile.role === 'admin' ? 'sheher' : state.profile.branch;
    $('fDate').value = today();
  }
  flatpickr("#fDate", { locale: "az", dateFormat: "Y-m-d", defaultDate: $('fDate').value || today() });
  openModal('financeModal');
}

$('financeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('fId').value; const type = $('fType').value;
  const data = {
    title: $('fTitle').value.trim(),
    amount: Number($('fAmount').value) || 0,
    date: $('fDate').value,
    branch: $('fBranch').value,
    note: $('fNote').value.trim(),
    updatedAt: Date.now(),
  };
  if (type === 'expenses') data.category = $('fCategory').value;
  try {
    if (id) {
      if (!can('finance.edit')) return toast('Redaktə icazəniz yoxdur', 'error');
      await db.ref('finance/' + type + '/' + id).update(data);
      await logAudit('update', type, id, data.title);
    } else {
      if (!can('finance.add')) return toast('Əlavə etmə icazəniz yoxdur', 'error');
      data.createdAt = Date.now();
      const ref = await db.ref('finance/' + type).push(data);
      await logAudit('create', type, ref.key, data.title);
    }
    toast("Yadda saxlandı");
    closeModal('financeModal');
  } catch (err) { toast("Xəta: " + err.message, "error"); }
});

function deleteFinance(type, id) {
  const r = state[type][id]; if (!r) return;
  if (!can('finance.delete')) return toast('Silmə icazəniz yoxdur', 'error');
  if (!canEdit(r)) return toast("İcazə yoxdur", "error");
  confirmAction("Qeydi silmək?", r.title || '', async () => {
    await db.ref('finance/' + type + '/' + id).remove();
    await logAudit('delete', type, id, r.title || '');
    toast("Silindi", "info");
  });
}

