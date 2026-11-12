/* ================================================================== */
/* =========== EXTRA SETTINGS CARDS (AI quota + Export) ============= */
/* ================================================================== */
async function renderExtraSettingsCards() {
  const grid = document.querySelector('#view-settings .grid');
  if (!grid) return;
  const isAdmin = state.profile.role === 'admin';
  const isManager = state.profile.role === 'manager';

  if (isAdmin) {
    const usage = await readAIUsageToday();
    const aiCard = document.createElement('div');
    aiCard.className = 'glass rounded-3xl p-6 lg:col-span-2';
    aiCard.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-head text-sm font-bold uppercase tracking-wider" style="color:var(--text-strong);"><i class="fa-solid fa-robot mr-2" style="color:var(--plum-600);"></i>AI Günlük Limit (50/50)</h3>
        <button onclick="resetAIUsageToday()" class="btn-ghost text-xs py-2 px-3"><i class="fa-solid fa-rotate-left mr-1"></i>Bugünü sıfırla</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="p-4 rounded-2xl glass-soft">
          <p class="eyebrow">Ümumi günlük limit</p>
          <div class="flex items-center gap-2 mt-2">
            <input id="aiDailyTotal" type="number" min="2" value="${usage.total}" class="input-style w-28 py-2"/>
            <button onclick="setAIDailyTotal(document.getElementById('aiDailyTotal').value)" class="btn-primary py-2 px-3 text-xs">Saxla</button>
          </div>
          <p class="text-[10px] mt-2" style="color:var(--text-muted);">Hər filiala: <b style="color:var(--text-strong);">${usage.perBranch}</b>/gün</p>
        </div>
        <div class="p-4 rounded-2xl" style="background:var(--teal-50);border:1px solid var(--teal-100);">
          <p class="eyebrow" style="color:var(--teal-700);">Şəhər</p>
          <p class="text-2xl font-bold mt-1" style="color:var(--text-strong);">${usage.sheher} <span class="text-sm font-medium" style="color:var(--text-muted);">/ ${usage.perBranch}</span></p>
          <div class="w-full h-2 rounded-full mt-2 overflow-hidden" style="background:var(--teal-100);"><div class="h-full" style="background:var(--teal-600);width:${Math.min(100, (usage.sheher / usage.perBranch) * 100)}%"></div></div>
        </div>
        <div class="p-4 rounded-2xl" style="background:var(--azure-50);border:1px solid var(--azure-100);">
          <p class="eyebrow" style="color:var(--azure-700);">Göynük</p>
          <p class="text-2xl font-bold mt-1" style="color:var(--text-strong);">${usage.goynuk} <span class="text-sm font-medium" style="color:var(--text-muted);">/ ${usage.perBranch}</span></p>
          <div class="w-full h-2 rounded-full mt-2 overflow-hidden" style="background:var(--azure-100);"><div class="h-full" style="background:var(--azure-600);width:${Math.min(100, (usage.goynuk / usage.perBranch) * 100)}%"></div></div>
        </div>
      </div>
      <p class="text-[10px]" style="color:var(--text-faint);">Tarix: ${usage.date} · Sayğac hər gün avtomatik sıfırlanır.</p>
    `;
    grid.appendChild(aiCard);
  }

  // Export card: available to admins (all-branch export) and managers
  // (their own branch only). Previously manager-only, which left admins —
  // who have the broadest data access — with no export UI at all.
  if (isAdmin || isManager) {
    const branch = isAdmin ? 'all' : state.profile.branch;
    const scopeLabel = isAdmin ? 'Bütün filiallar' : BRANCH_LABEL[branch];
    const exportCard = document.createElement('div');
    exportCard.className = 'glass rounded-3xl p-6 lg:col-span-2';
    exportCard.innerHTML = `
      <h3 class="font-head text-sm font-bold uppercase tracking-wider mb-4" style="color:var(--text-strong);"><i class="fa-solid fa-download mr-2" style="color:var(--accent-text);"></i>Məlumat Endirilməsi (${scopeLabel})</h3>
      <p class="text-xs mb-4" style="color:var(--text-muted);">${isAdmin ? 'Admin olaraq bütün filialların məlumatlarını endirə bilərsiniz.' : 'Seçilmiş modullar üzrə yalnız öz filialınızın məlumatlarını endirə bilərsiniz.'}</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" id="exportModules">
        ${[
        ['students', 'Şagirdlər'],
        ['teachers', 'Müəllimlər'],
        ['examResults', 'İmtahan nəticələri'],
        ['income', 'Gəlirlər'],
        ['expenses', 'Xərclər'],

      ].map(([k, l]) => `
          <label class="flex items-center gap-2 p-2 rounded-xl glass-soft cursor-pointer transition" onmouseover="this.style.background='var(--surface-sunken)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="export-mod" value="${k}" checked />
            <span class="text-xs font-medium" style="color:var(--text);">${l}</span>
          </label>`).join('')}
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="exportBranchData('json')" class="btn-primary py-2 px-4 text-xs"><i class="fa-solid fa-file-code mr-2"></i>JSON</button>
        <button onclick="exportBranchData('excel')" class="btn-primary py-2 px-4 text-xs"><i class="fa-solid fa-file-excel mr-2"></i>Excel</button>
        <button onclick="exportBranchData('pdf')" class="btn-primary py-2 px-4 text-xs"><i class="fa-solid fa-file-pdf mr-2"></i>PDF</button>
      </div>
    `;
    grid.appendChild(exportCard);
  }
}


function _collectBranchExport() {
  const branch = state.profile.branch; // 'sheher' | 'goynuk' | 'all' (admin)
  const sel = Array.from(document.querySelectorAll('.export-mod:checked')).map(el => el.value);
  // Admins (branch === 'all') export every branch; managers are scoped to
  // their own. Previously this always compared v.branch === 'all', which
  // never matches a real record and silently produced empty exports for
  // admins — this is why admin export UI was hidden entirely until now.
  const inBranch = (v) => v && (branch === 'all' || v.branch === branch);
  const data = {};
  if (sel.includes('students')) {
    data.students = {};
    Object.entries(state.students || {}).forEach(([k, v]) => { if (inBranch(v)) data.students[k] = v; });
  }
  if (sel.includes('teachers')) {
    data.teachers = {};
    Object.entries(state.teachers || {}).forEach(([k, v]) => { if (inBranch(v)) data.teachers[k] = v; });
  }
  if (sel.includes('examResults')) {
    const sids = new Set(Object.keys(data.students || {}));
    // if students not selected, still scope by branch
    if (!sel.includes('students')) {
      Object.entries(state.students || {}).forEach(([k, v]) => { if (inBranch(v)) sids.add(k); });
    }
    data.examResults = {};
    Object.entries(state.examResults || {}).forEach(([sid, res]) => { if (sids.has(sid)) data.examResults[sid] = res; });
  }
  if (sel.includes('income')) {
    data.income = {};
    Object.entries(state.income || {}).forEach(([k, v]) => { if (inBranch(v)) data.income[k] = v; });
  }
  if (sel.includes('expenses')) {
    data.expenses = {};
    Object.entries(state.expenses || {}).forEach(([k, v]) => { if (inBranch(v)) data.expenses[k] = v; });
  }
  if (sel.includes('audit')) {
    data.audit = {};
    Object.entries(state.audit || {}).forEach(([k, v]) => {
      // audit doesn't have branch; include all done by branch users
      const u = state.users[v.userId];
      if (u && (branch === 'all' || u.branch === branch)) data.audit[k] = v;
    });
  }
  return { branch, modules: sel, data };
}

async function exportBranchData(format) {
  if (!can('export')) return toast('İcazə yoxdur', 'error');
  const { branch, modules, data } = _collectBranchExport();
  if (!modules.length) return toast('Ən azı bir modul seçin', 'error');
  const stamp = today();
  const base = `meram_${branch}_${stamp}`;
  try {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      _downloadBlob(blob, base + '.json');
    } else if (format === 'excel') {
      if (typeof XLSX === 'undefined') return toast('Excel kitabxanası yüklənmədi', 'error');
      const wb = XLSX.utils.book_new();
      Object.entries(data).forEach(([mod, obj]) => {
        const rows = _flattenForSheet(mod, obj);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, mod.slice(0, 31));
      });
      XLSX.writeFile(wb, base + '.xlsx');
    } else if (format === 'pdf') {
      if (typeof window.jspdf === 'undefined') return toast('PDF kitabxanası yüklənmədi', 'error');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text(`Məram ERP — ${BRANCH_LABEL[branch]} (${stamp})`, 14, 14);
      let y = 22;
      Object.entries(data).forEach(([mod, obj]) => {
        const rows = _flattenForSheet(mod, obj);
        if (!rows.length) return;
        doc.setFontSize(11);
        doc.text(mod.toUpperCase(), 14, y);
        const cols = Object.keys(rows[0]);
        doc.autoTable({
          startY: y + 2,
          head: [cols],
          body: rows.map(r => cols.map(c => String(r[c] ?? ''))),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillBy: 'rgb', fillColor: [15, 118, 110] },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
        if (y > 180) { doc.addPage(); y = 14; }
      });
      doc.save(base + '.pdf');
    }
    await logAudit('export', branch, format, `modules: ${modules.join(',')}`);
    toast('Endirildi: ' + base + '.' + (format === 'excel' ? 'xlsx' : format));
  } catch (err) {
    toast('Export xətası: ' + err.message, 'error');
  }
}
function _downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}
function _flattenForSheet(mod, obj) {
  const rows = [];
  if (mod === 'examResults') {
    Object.entries(obj || {}).forEach(([sid, res]) => {
      const sname = state.students?.[sid]?.name || sid;
      Object.entries(res || {}).forEach(([rid, r]) => {
        rows.push({ id: rid, studentId: sid, student: sname, examName: r.examName, date: r.date, ...r });
      });
    });
  } else {
    Object.entries(obj || {}).forEach(([k, v]) => {
      const flat = { id: k };
      Object.entries(v || {}).forEach(([kk, vv]) => {
        if (typeof vv === 'object') flat[kk] = JSON.stringify(vv);
        else flat[kk] = vv;
      });
      rows.push(flat);
    });
  }
  return rows;
}

