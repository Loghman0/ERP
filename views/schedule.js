/* ================= SCHEDULE / TIMETABLE ================= */
const DAY_LABELS = ['B.E.', 'Ç.A.', 'Çər.', 'C.A.', 'Cüm.', 'Şən.'];
const SCHEDULE_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
let scheduleFilter = { teacherId: 'all', room: 'all' };

function renderSchedule() {
  if (!can('schedule')) { $('view-schedule').innerHTML = aiNoAccessHTML(); return; }
  const v = $('view-schedule');
  const branch = activeBranch();
  const teachers = filterByBranch(state.teachers).filter(([id, t]) => isTeacherRole(t)).map(([id, t]) => ({ id, ...t }));
  const entries = scheduleEntriesFiltered();
  const rooms = Array.from(new Set(Object.values(state.schedule || {}).map(e => e.room).filter(Boolean))).sort();
  v.innerHTML = `
    <div class="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <p class="text-[10px] uppercase text-slate-500 font-bold mb-1">Müəllim</p>
        <select id="schedTeacher" class="input-style w-56" onchange="scheduleFilter.teacherId=this.value;renderSchedule()">
          <option value="all">Bütün müəllimlər</option>
          ${teachers.map(t => `<option value="${t.id}" ${scheduleFilter.teacherId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <p class="text-[10px] uppercase text-slate-500 font-bold mb-1">Otaq</p>
        <select id="schedRoom" class="input-style w-44" onchange="scheduleFilter.room=this.value;renderSchedule()">
          <option value="all">Bütün otaqlar</option>
          ${rooms.map(r => `<option value="${escapeHtml(r)}" ${scheduleFilter.room === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
        </select>
      </div>
      ${can('schedule.edit') ? `<button onclick="openScheduleModal()" class="ml-auto btn-primary"><i class="fa-solid fa-plus mr-2"></i>Yeni dərs bloku</button>` : ''}
    </div>
    <div class="glass rounded-3xl p-3 overflow-x-auto">
      <div class="schedule-grid" style="min-width:880px">
        <div class="sg-head"></div>
        ${DAY_LABELS.map(d => `<div class="sg-head">${d}</div>`).join('')}
        ${SCHEDULE_HOURS.map((h, hi) => {
    let row = `<div class="sg-time">${h}</div>`;
    for (let d = 0; d < 6; d++) {
      const inSlot = entries.filter(e => e.day === d && e.start <= h && e.end > h);
      const isStart = inSlot.filter(e => e.start === h);
      const conflict = inSlot.length > 1;
      row += `<div class="sg-cell" onclick="openScheduleModal(null,${d},'${h}')">${isStart.map(e => `
              <div class="schedule-block ${conflict ? 'conflict' : ''}" onclick="event.stopPropagation();openScheduleModal('${e.id}')">
                <div class="sb-title">${escapeHtml(scheduleLabel(e))}</div>
                <div class="sb-meta">${e.start}–${e.end} · ${escapeHtml(e.room || '—')}</div>
              </div>`).join('')}</div>`;
    }
    return row;
  }).join('')}
      </div>
    </div>
    <p class="text-[11px] text-slate-500 mt-4"><i class="fa-solid fa-circle-info mr-1"></i>Boş xanaya klikləyərək yeni dərs əlavə edin. Eyni vaxt + otaq və ya eyni vaxt + müəllim toqquşması <span class="text-red-400 font-bold">qırmızı</span> ilə işarələnir.</p>
  `;
}

// escapeHtml now lives in js/utils.js (loaded before all views).
function scheduleLabel(e) {
  const t = state.teachers[e.teacherId];
  return (t?.name || '?') + ' · ' + (e.subjectId || '');
}

function scheduleEntriesFiltered() {
  const branch = activeBranch();
  return Object.entries(state.schedule || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter(e => branch === 'all' || e.branch === branch)
    .filter(e => scheduleFilter.teacherId === 'all' || e.teacherId === scheduleFilter.teacherId)
    .filter(e => scheduleFilter.room === 'all' || e.room === scheduleFilter.room);
}

function scheduleConflict(entry, ignoreId) {
  // Check overlap on same day with same room OR same teacher
  const items = Object.entries(state.schedule || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter(e => e.id !== ignoreId && e.day === entry.day && e.branch === entry.branch);
  for (const e of items) {
    const overlap = entry.start < e.end && entry.end > e.start;
    if (!overlap) continue;
    if (e.room && entry.room && e.room === entry.room) return { with: e, type: 'room' };
    if (e.teacherId && entry.teacherId && e.teacherId === entry.teacherId) return { with: e, type: 'teacher' };
  }
  return null;
}

function openScheduleModal(id, presetDay, presetStart) {
  // Build modal dynamically (single-use)
  const existing = id ? state.schedule[id] : null;
  const teachers = filterByBranch(state.teachers).filter(([_, t]) => isTeacherRole(t)).map(([tid, t]) => ({ id: tid, ...t }));
  const allSubs = state.subjects.concat(state.summerSubjects);
  const html = `
    <div id="scheduleModalDyn" class="modal-bg" style="z-index:170;" aria-labelledby="scheduleModalDynTitle">
      <div class="overlay-surface rounded-[28px] p-6 sm:p-8 w-full max-w-lg shadow-2xl">
        <div class="flex items-center justify-between mb-6 pb-4 border-b" style="border-color:var(--border);">
          <h3 id="scheduleModalDynTitle" class="font-head text-lg font-bold" style="color:var(--text-strong);">${id ? 'Dərs blokunu redaktə et' : 'Yeni dərs bloku'}</h3>
          <button type="button" onclick="closeScheduleModal()" class="text-xl w-9 h-9 flex items-center justify-center rounded-full transition" style="color:var(--text-muted);" onmouseover="this.style.background='var(--surface-soft)'" onmouseout="this.style.background=''"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="scheduleFormDyn" class="space-y-4">
          <select id="schTeacher" class="input-style" required>
            <option value="">Müəllim *</option>
            ${teachers.map(t => `<option value="${t.id}" ${existing && existing.teacherId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
          <select id="schSubject" class="input-style" required>
            <option value="">Fənn *</option>
            ${allSubs.map(s => `<option value="${escapeHtml(s)}" ${existing && existing.subjectId === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
          </select>
          <div class="grid grid-cols-3 gap-3">
            <select id="schDay" class="input-style" required>
              ${DAY_LABELS.map((d, i) => `<option value="${i}" ${(existing ? existing.day : presetDay) == i ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select id="schStart" class="input-style" required>
              ${SCHEDULE_HOURS.map(h => `<option value="${h}" ${(existing ? existing.start : presetStart) === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
            <select id="schEnd" class="input-style" required>
              ${SCHEDULE_HOURS.concat(['21:00']).map(h => `<option value="${h}" ${existing && existing.end === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input type="text" id="schRoom" class="input-style" placeholder="Otaq (məs: 101)" value="${existing ? escapeHtml(existing.room || '') : ''}" />
            <select id="schBranch" class="input-style" required>
              <option value="sheher" ${(existing ? existing.branch : (state.profile.role === 'admin' ? 'sheher' : state.profile.branch)) === 'sheher' ? 'selected' : ''}>Şəhər Filialı</option>
              <option value="goynuk" ${(existing ? existing.branch : (state.profile.role === 'admin' ? 'sheher' : state.profile.branch)) === 'goynuk' ? 'selected' : ''}>Göynük Filialı</option>
            </select>
          </div>
          <div id="schConflictMsg" class="hidden p-3 rounded-2xl text-xs font-semibold" style="background:var(--red-50);border:1px solid var(--red-100);color:var(--red-700);"></div>
          <div class="flex gap-3 pt-3">
            ${id ? `<button type="button" onclick="deleteSchedule('${id}')" class="btn-danger px-5"><i class="fa-solid fa-trash mr-2"></i>Sil</button>` : ''}
            <button type="submit" class="flex-1 btn-primary py-3 rounded-2xl"><i class="fa-solid fa-check mr-2"></i>Yadda saxla</button>
          </div>
        </form>
      </div>
    </div>`;
  const old = $('scheduleModalDyn'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  openModal('scheduleModalDyn'); // was: raw "active" class in the template above — see openModal() for why this matters (focus trap, aria-modal, Escape)
  $('scheduleFormDyn').addEventListener('submit', async (e) => {
    e.preventDefault();
    const entry = {
      teacherId: $('schTeacher').value,
      subjectId: $('schSubject').value,
      day: Number($('schDay').value),
      start: $('schStart').value,
      end: $('schEnd').value,
      room: $('schRoom').value.trim(),
      branch: $('schBranch').value,
      updatedAt: Date.now()
    };
    if (entry.end <= entry.start) { $('schConflictMsg').classList.remove('hidden'); $('schConflictMsg').textContent = 'Bitmə vaxtı başlanğıcdan sonra olmalıdır'; return; }
    if (!can('schedule.edit')) return toast('Cədvəl redaktə icazəniz yoxdur', 'error');
    const conflict = scheduleConflict(entry, id);
    if (conflict) {
      const w = conflict.with;
      $('schConflictMsg').classList.remove('hidden');
      $('schConflictMsg').innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Toqquşma: ${conflict.type === 'room' ? 'eyni otaq' : 'eyni müəllim'} — ${scheduleLabel(w)} (${w.start}–${w.end})`;
      return;
    }
    try {
      if (id) {
        await db.ref('schedule/' + id).update(entry);
        await logAudit('update', 'schedule', id, scheduleLabel(entry));
      } else {
        entry.createdAt = Date.now();
        const ref = await db.ref('schedule').push(entry);
        await logAudit('create', 'schedule', ref.key, scheduleLabel(entry));
      }
      toast('Cədvəl yeniləndi');
      closeScheduleModal();
    } catch (err) { toast('Xəta: ' + err.message, 'error'); }
  });
}
function closeScheduleModal() { const el = $('scheduleModalDyn'); if (el) { closeModal(el.id); el.remove(); } }
function deleteSchedule(id) {
  if (!can('schedule.edit')) return toast('Silmə icazəniz yoxdur', 'error');
  confirmAction('Dərs blokunu silmək?', '', async () => {
    await db.ref('schedule/' + id).remove();
    await logAudit('delete', 'schedule', id, '');
    toast('Silindi', 'info');
    closeScheduleModal();
  });
}

