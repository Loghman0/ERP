/* ================= ATTENDANCE ================= */
let attendanceState = { date: null, subjectId: 'all' };
function renderAttendance() {
  if (!can('attendance')) { $('view-attendance').innerHTML = aiNoAccessHTML(); return; }
  const v = $('view-attendance');
  const branch = activeBranch();
  attendanceState.date = attendanceState.date || today();

  // unique subjects from students in current branch
  const studentRecs = filterByBranch(state.students).map(([id, s]) => ({ id, ...s }));
  const subjSet = new Set();
  studentRecs.forEach(s => getStudentSubjects(s).forEach(sub => { if (sub.subject) subjSet.add(sub.subject); }));
  const subjects = Array.from(subjSet).sort();

  v.innerHTML = `
    <div class="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <p class="text-[10px] uppercase text-slate-500 font-bold mb-1">Tarix</p>
        <input id="attDate" type="text" class="input-style w-44" value="${attendanceState.date}" />
      </div>
      <div>
        <p class="text-[10px] uppercase text-slate-500 font-bold mb-1">Fənn</p>
        <select id="attSubject" class="input-style w-56" onchange="attendanceState.subjectId=this.value;renderAttendance()">
          <option value="all">Bütün fənlər</option>
          ${subjects.map(s => `<option value="${escapeHtml(s)}" ${attendanceState.subjectId === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      <div class="ml-auto flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 text-[11px] text-slate-400">
          <span class="att-radio active present">✓</span><span>İştirak</span>
          <span class="att-radio active absent ml-3">✗</span><span>Yox</span>
          <span class="att-radio active excused ml-3">E</span><span>İcazəli</span>
        </div>
        <button onclick="markAllPresent()" class="btn-primary py-2 px-3 text-xs" title="Cədvəldəki bütün şagirdləri iştirak etdi qeyd et">
          <i class="fa-solid fa-check-double mr-1"></i>Hamısı ✓
        </button>
      </div>
    </div>
    <div id="attendanceTableWrap" class="glass rounded-3xl overflow-hidden"></div>
    <div id="attendanceMonthly" class="mt-5"></div>
  `;
  try { flatpickr('#attDate', { locale: 'az', dateFormat: 'Y-m-d', defaultDate: attendanceState.date, onChange: (sel, str) => { attendanceState.date = str; renderAttendanceTable(); renderAttendanceMonthly(); } }); } catch (e) { }
  renderAttendanceTable();
  renderAttendanceMonthly();
}

async function markAllPresent() {
  if (!can('attendance')) return toast('İcazə yoxdur', 'error');
  const students = attendanceStudents();
  if (!students.length) return toast('Göstəriləcək şagird yoxdur', 'info');
  const date = attendanceState.date || today();
  const subj = attendanceState.subjectId || 'all';
  const promises = students.map(s => {
    const path = `attendance/${date}/${s.branch}/${encodeURIComponent(subj)}/${s.id}`;
    state.attendance = state.attendance || {};
    state.attendance[date] = state.attendance[date] || {};
    state.attendance[date][s.branch] = state.attendance[date][s.branch] || {};
    state.attendance[date][s.branch][subj] = state.attendance[date][s.branch][subj] || {};
    state.attendance[date][s.branch][subj][s.id] = 'present';
    return db.ref(path).set('present');
  });
  try {
    await Promise.all(promises);
    renderAttendanceTable();
    renderAttendanceMonthly();
    toast(`${students.length} şagird iştirak etdi qeyd edildi`);
  } catch (e) { toast('Xəta: ' + e.message, 'error'); }
}

function attendanceStudents() {
  const branch = activeBranch();
  let list = filterByBranch(state.students).map(([id, s]) => ({ id, ...s }));
  if (attendanceState.subjectId && attendanceState.subjectId !== 'all') {
    list = list.filter(s => getStudentSubjects(s).some(sub => sub.subject === attendanceState.subjectId));
  }
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'az'));
}

function renderAttendanceTable() {
  const wrap = $('attendanceTableWrap'); if (!wrap) return;
  const date = attendanceState.date || today();
  const subj = attendanceState.subjectId || 'all';
  const branch = activeBranch() === 'all' ? '__all' : activeBranch();
  const dayData = ((state.attendance || {})[date] || {});
  const get = (sid) => {
    // search across branches if branch='all'
    const branches = branch === '__all' ? ['sheher', 'goynuk'] : [branch];
    for (const b of branches) {
      const v = (((dayData[b] || {})[subj] || {})[sid]);
      if (v) return v;
    }
    return null;
  };
  const students = attendanceStudents();
  let html = `<table class="responsive-table w-full text-sm">
    <thead class="bg-white/5 border-b border-white/5">
      <tr class="text-[10px] uppercase tracking-widest text-slate-400 font-black">
        <th class="text-left px-5 py-3">Şagird</th>
        <th class="text-left px-5 py-3">Sinif</th>
        <th class="text-left px-5 py-3">Filial</th>
        <th class="text-center px-5 py-3">Status</th>
      </tr>
    </thead><tbody>`;
  if (!students.length) {
    html += `<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Şagird yoxdur</p></div></td></tr>`;
  } else {
    students.forEach(s => {
      const st = get(s.id);
      html += `<tr class="border-b border-white/5 hover:bg-white/[0.02]">
        <td data-label="Şagird" class="px-5 py-2 font-bold text-white">${escapeHtml((s.name || '') + ' ' + (s.surname || ''))}</td>
        <td data-label="Sinif" class="px-5 py-2 text-slate-400 text-xs">${escapeHtml(classLabel(s.class))}</td>
        <td data-label="Filial" class="px-5 py-2"><span class="badge ${s.branch === 'sheher' ? 'badge-emerald' : 'badge-blue'}">${escapeHtml(BRANCH_LABEL[s.branch] || '-')}</span></td>
        <td data-label="Status" class="px-5 py-2 text-center">
          <div class="inline-flex gap-2">
            <span onclick="setAttendance('${s.id}','${s.branch}','present')" class="att-radio ${st === 'present' ? 'active present' : ''}" title="İştirak etdi">✓</span>
            <span onclick="setAttendance('${s.id}','${s.branch}','absent')" class="att-radio ${st === 'absent' ? 'active absent' : ''}" title="İştirak etmədi">✗</span>
            <span onclick="setAttendance('${s.id}','${s.branch}','excused')" class="att-radio ${st === 'excused' ? 'active excused' : ''}" title="İcazəli">E</span>
          </div>
        </td>
      </tr>`;
    });
  }
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

async function setAttendance(studentId, studentBranch, status) {
  const s = state.students[studentId]; if (!s) return;
  if (!canEdit(s)) return toast('İcazə yoxdur', 'error');
  const date = attendanceState.date || today();
  const subj = attendanceState.subjectId || 'all';
  const path = `attendance/${date}/${studentBranch}/${encodeURIComponent(subj)}/${studentId}`;
  try {
    const snap = await db.ref(path).get();
    if (snap.val() === status) { await db.ref(path).remove(); }
    else { await db.ref(path).set(status); }
    // local update
    state.attendance = state.attendance || {};
    state.attendance[date] = state.attendance[date] || {};
    state.attendance[date][studentBranch] = state.attendance[date][studentBranch] || {};
    state.attendance[date][studentBranch][subj] = state.attendance[date][studentBranch][subj] || {};
    if (snap.val() === status) delete state.attendance[date][studentBranch][subj][studentId];
    else state.attendance[date][studentBranch][subj][studentId] = status;
    renderAttendanceTable();
    renderAttendanceMonthly();
  } catch (e) { toast('Xəta: ' + e.message, 'error'); }
}

function renderAttendanceMonthly() {
  const wrap = $('attendanceMonthly'); if (!wrap) return;
  const date = attendanceState.date || today();
  const m = monthKey(date);
  const branch = activeBranch();
  const students = attendanceStudents();
  // aggregate per student over the month
  const stats = {};
  students.forEach(s => stats[s.id] = { present: 0, absent: 0, excused: 0, total: 0, name: `${s.name || ''} ${s.surname || ''}` });
  Object.entries(state.attendance || {}).forEach(([d, byBranch]) => {
    if (monthKey(d) !== m) return;
    Object.entries(byBranch || {}).forEach(([b, bySubj]) => {
      if (branch !== 'all' && b !== branch) return;
      Object.entries(bySubj || {}).forEach(([sid_subj, bySid]) => {
        Object.entries(bySid || {}).forEach(([sid, st]) => {
          if (!stats[sid]) return;
          if (stats[sid][st] !== undefined) stats[sid][st]++;
          stats[sid].total++;
        });
      });
    });
  });
  const rows = Object.values(stats).filter(r => r.total > 0)
    .sort((a, b) => (b.present / Math.max(1, b.total)) - (a.present / Math.max(1, a.total)));
  if (!rows.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="glass rounded-3xl p-5">
      <p class="eyebrow mb-3"><i class="fa-solid fa-chart-bar mr-2" style="color:var(--accent-text);"></i>${escapeHtml(m)} ayı üzrə ümumi xülasə</p>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${rows.slice(0, 30).map(r => {
    const pct = Math.round((r.present / r.total) * 100);
    const color = pct >= 80 ? 'emerald' : pct >= 60 ? 'amber' : 'red';
    return `<div class="glass-soft rounded-2xl p-3">
            <p class="text-xs font-bold truncate" style="color:var(--text-strong);">${escapeHtml(r.name)}</p>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full bg-${color}-500" style="width:${pct}%"></div></div>
              <span class="text-xs font-bold text-${color}-400">${pct}%</span>
            </div>
            <p class="text-[10px] mt-1" style="color:var(--text-faint);">${r.present} iştirak · ${r.absent} yox · ${r.excused} icazəli</p>
          </div>`;
  }).join('')}
      </div>
    </div>`;
}

