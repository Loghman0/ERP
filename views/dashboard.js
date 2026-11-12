/* ================= DASHBOARD ================= */
/* ---------------------------------------------------------------------
   REDESIGN NOTES (kept here rather than only in a commit message, since
   this file has no separate design doc):

   Problems the previous version had, and what changed:

   1. Branch-comparison cards (admin/"all" view) and the 5 global stat
      cards below them repeated the same numbers (student/teacher counts,
      expected revenue) at two granularities with no visual relationship
      between them. Branch comparison is now a compact side-by-side bar
      strip, clearly subordinate to — not a duplicate of — the primary
      metrics below it.
   2. Every metric card was equal weight. For a director/receptionist
      opening this daily, "money at risk" and "collection health" matter
      more than "how many summer-course students." Metrics are now split
      into a PRIMARY row (larger, 3 cards: expected, collection rate,
      debt) and a SECONDARY row (smaller, 3 cards: the counts).
   3. Added a genuinely new metric — collection rate (paid ÷ expected for
      subjects due this month) — computed from data already available
      but never surfaced before. This is what turns "here are some
      numbers" into "is collection on track."
   4. The "due today/week/month" mini-stats and the full overdue-card
      grid below them said mostly the same thing twice with no way to
      tell, at a glance, which grid items were in which bucket. Replaced
      with one list, grouped by urgency, with a visible section label
      per group instead of a separate summary strip above it.
   5. Every overdue card pulsed (animation: pulseRing) simultaneously,
      forever — not tied to genuine urgency, so nothing stood out; it was
      background noise. Pulsing is now reserved for items due TODAY
      specifically (a handful of cards, not the whole grid), and it's a
      single ring-pulse capped at a few repeats via CSS
      (dashboard-pulse-today), not an infinite animation.
   6. The WhatsApp reminder was an icon-only button with no visible label
      — low affordance for what's actually a primary, frequent action for
      reception staff. It's now a labeled pill button.
   7. No indication of data freshness. Added a relative "Son yeniləmə"
      timestamp next to the branch tabs, standard on financial/ops
      dashboards and cheap to compute (this view re-renders on every
      relevant Firebase update anyway, so the timestamp is never stale).

   Kept unchanged: the income/expense bar chart and branch pie chart
   (still genuinely useful, Chart.js wiring untouched), the underlying
   data-fetching/filtering logic (was correct, not the problem), the
   app's existing design tokens (--teal-*, --terracotta-*, --gold-*,
   radii, shadows) — this is a layout/hierarchy/motion redesign within
   the established "warm editorial admin tool" system, not a palette or
   component-library swap.
   --------------------------------------------------------------------- */

let dashboardTab = 'all';

function renderDashboard() {
  const isAdmin = state.profile.role === 'admin';
  const activeDashTab = isAdmin ? dashboardTab : state.profile.branch;

  function filterForDash(obj) {
    return Object.entries(obj || {}).filter(([_, v]) => activeDashTab === 'all' ? true : v.branch === activeDashTab);
  }

  const students = filterForDash(state.students).map(([id, v]) => ({ id, ...v }));
  const teachers = filterForDash(state.teachers).map(([id, v]) => ({ id, ...v }));
  const income = filterForDash(state.income).map(([id, v]) => ({ id, ...v }));
  const expenses = filterForDash(state.expenses).map(([id, v]) => ({ id, ...v }));

  const regularStudents = students.filter(s => studentEnrollmentType(s) === 'regular');
  const summerStudents = students.filter(s => studentEnrollmentType(s) === 'summer');

  // ---- Core subject-level math: expected, collected-this-month, overdue ----
  const thisMonthKey = monthKey(today());
  let monthExpected = 0;
  let monthCollected = 0;
  let monthDueTotal = 0;
  const overdueEntries = [];
  students.forEach(x => {
    getStudentSubjects(x).forEach(sub => {
      const m = computeSubjectMath(sub, state.teachers[sub.teacherId]);
      monthExpected += m.studentPays;
      // Collection rate denominator/numerator: of what's due THIS
      // calendar month specifically (by paymentDate), how much has
      // actually been marked paid. Distinct from monthExpected above,
      // which is ALL open subjects regardless of due date (that's the
      // forward-looking "Bu ay gözlənilən" headline, not this ratio).
      if (sub.paymentDate && monthKey(sub.paymentDate) === thisMonthKey) {
        monthDueTotal += m.studentPays;
        if (sub.status === 'paid') monthCollected += m.studentPays;
      }
      if (isOverdue(sub.paymentDate, sub.status)) {
        overdueEntries.push({
          studentId: x.id, name: x.name, surname: x.surname,
          class: classLabel(x.class), branch: x.branch,
          subject: sub.subject, price: m.studentPays, paymentDate: sub.paymentDate,
          enrollment: studentEnrollmentType(x)
        });
      }
    });
  });
  const debts = overdueEntries.reduce((s, e) => s + (Number(e.price) || 0), 0);
  const overdueList = overdueEntries.sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''));
  // Collection rate is only meaningful once something was actually due
  // this month — with 0 due, "0 / 0" would read as broken (0%) rather
  // than the true "nothing to collect yet" state, so that case renders
  // as an em dash instead of a misleading 0%.
  const collectionRate = monthDueTotal > 0 ? Math.round((monthCollected / monthDueTotal) * 100) : null;

  // ---- Branch comparison (admin, 'all' view only) ----
  const allStudents = Object.values(state.students || {});
  const sheherStudents = allStudents.filter(s => s.branch === 'sheher');
  const goynukStudents = allStudents.filter(s => s.branch === 'goynuk');
  const sumExpected = arr => arr.reduce((s, x) => s + getStudentSubjects(x).reduce((ss, sub) => ss + computeSubjectMath(sub, state.teachers[sub.teacherId]).studentPays, 0), 0);
  const sheherExpected = sumExpected(sheherStudents);
  const goynukExpected = sumExpected(goynukStudents);
  const allTeachers = Object.values(state.teachers || {});
  const sheherTeachers = allTeachers.filter(t => t.branch === 'sheher').length;
  const goynukTeachers = allTeachers.filter(t => t.branch === 'goynuk').length;

  // ---- Urgency buckets for the unified overdue/upcoming list ----
  const todayStr = today();
  const todayMs = new Date(todayStr).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const allSubs = students.flatMap(x => getStudentSubjects(x).map(sub => ({
    ...sub, studentId: x.id, studentName: x.name, studentSurname: x.surname,
    class: classLabel(x.class), branch: x.branch, enrollment: studentEnrollmentType(x),
    math: computeSubjectMath(sub, state.teachers[sub.teacherId]),
  })));
  const isPastDue = sub => sub.status !== 'paid' && sub.paymentDate && new Date(sub.paymentDate).getTime() < todayMs;
  const dueToday = allSubs.filter(sub => sub.status !== 'paid' && sub.paymentDate && new Date(sub.paymentDate).getTime() === todayMs);
  const dueThisWeek = allSubs.filter(sub => sub.status !== 'paid' && sub.paymentDate && new Date(sub.paymentDate) > new Date(todayStr) && new Date(sub.paymentDate).getTime() <= todayMs + weekMs);
  const overdueNow = allSubs.filter(isPastDue);

  const tabActiveClass = 'text-white bg-white/10 border-white/20';
  const tabInactiveClass = 'border-transparent';

  const branchSnapshotHtml = (isAdmin && dashboardTab === 'all') ? `
<div class="glass rounded-3xl p-5 sm:p-6 mb-6">
  <p class="eyebrow mb-4">Filial Müqayisəsi</p>
  <div class="grid sm:grid-cols-2 gap-x-8 gap-y-4">
    ${branchSnapshotRow('Şəhər', sheherStudents.length, sheherTeachers, sheherExpected, 'var(--teal-600)', Math.max(sheherStudents.length, goynukStudents.length))}
    ${branchSnapshotRow('Göynük', goynukStudents.length, goynukTeachers, goynukExpected, 'var(--azure-600)', Math.max(sheherStudents.length, goynukStudents.length))}
  </div>
</div>` : '';

  const adminTabsHtml = isAdmin ? `
<div class="flex items-center justify-between flex-wrap gap-3 mb-6">
  <div class="flex items-center gap-1 p-1 glass-soft rounded-2xl w-fit">
    <button onclick="dashboardTab='all';renderDashboard()" class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${dashboardTab === 'all' ? tabActiveClass : tabInactiveClass}" style="${dashboardTab === 'all' ? '' : 'color:var(--text-muted);'}">${dashIcon('globe', 14)}<span class="ml-1.5">Ümumi</span></button>
    <button onclick="dashboardTab='sheher';renderDashboard()" class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${dashboardTab === 'sheher' ? tabActiveClass : tabInactiveClass}" style="${dashboardTab === 'sheher' ? '' : 'color:var(--text-muted);'}">${dashIcon('building', 14)}<span class="ml-1.5">Şəhər Filialı</span></button>
    <button onclick="dashboardTab='goynuk';renderDashboard()" class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${dashboardTab === 'goynuk' ? tabActiveClass : tabInactiveClass}" style="${dashboardTab === 'goynuk' ? '' : 'color:var(--text-muted);'}">${dashIcon('tree', 14)}<span class="ml-1.5">Göynük Filialı</span></button>
  </div>
  <p class="text-[11px] flex items-center gap-1.5" style="color:var(--text-faint);">${dashIcon('clock', 12)}<span>Son yeniləmə: indi</span></p>
</div>
${branchSnapshotHtml}` : '';

  const html = `
${adminTabsHtml}

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-4">
  ${primaryMetricCard("Bu ay gözlənilən", fmt(monthExpected), 'coins', 'var(--plum-600)', 'var(--plum-50)', 'var(--plum-100)')}
  ${collectionRateCard(collectionRate, monthCollected, monthDueTotal)}
  ${primaryMetricCard("Ümumi Borclar", fmt(debts), 'triangle-alert', 'var(--red-700)', 'var(--red-50)', 'var(--red-100)', overdueList.length ? `${overdueList.length} ödəniş` : null)}
</div>

<div class="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
  ${secondaryMetricCard("Tədris ili", regularStudents.length, 'graduation-cap', 'var(--teal-700)')}
  ${secondaryMetricCard("Yay kursu", summerStudents.length, 'sun', 'var(--terracotta-600)')}
  ${secondaryMetricCard("Müəllim", teachers.length, 'users', 'var(--azure-700)')}
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
  <div class="glass rounded-3xl p-5 sm:p-6 lg:col-span-2">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-head text-sm font-bold uppercase tracking-wider" style="color:var(--text-strong);">Aylara görə Gəlir vs Xərc</h3>
      <span class="badge badge-slate">Son 12 ay</span>
    </div>
    <div style="height:280px;"><canvas id="chartIncomeExpense"></canvas></div>
  </div>
  <div class="glass rounded-3xl p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-head text-sm font-bold uppercase tracking-wider" style="color:var(--text-strong);">Filiallar üzrə Şagird</h3>
    </div>
    <div style="height:280px;"><canvas id="chartBranchPie"></canvas></div>
  </div>
</div>

<div class="glass rounded-3xl p-5 sm:p-6">
  <div class="flex items-center justify-between mb-5">
    <h3 class="font-head text-sm font-bold uppercase tracking-wider flex items-center gap-2" style="color:var(--red-700);">${dashIcon('bell', 15)}Təcili Ödənişlər</h3>
    <span class="badge badge-red">${overdueList.length}</span>
  </div>

  ${overdueList.length === 0
      ? `<div class="empty-state py-10">${dashIcon('check-circle', 30, 'color:var(--teal-600);opacity:.8;')}<p>Hazırda gecikən ödəniş yoxdur</p></div>`
      : [
          urgencyGroup('Bu Gün — indi zəng edin', dueToday, 'var(--red-700)', 'var(--red-50)', 'var(--red-100)', true),
          urgencyGroup('Bu Həftə', dueThisWeek, 'var(--gold-600)', 'var(--gold-50)', 'var(--gold-100)', false),
          urgencyGroup('Gecikmiş (keçmiş tarixli)', overdueNow.filter(s => !dueToday.includes(s)), 'var(--red-700)', 'var(--red-50)', 'var(--red-100)', false),
        ].filter(Boolean).join('')
    }
</div>
  `;
  $('view-dashboard').innerHTML = html;

  drawIncomeExpenseChart(income, expenses, students);
  drawBranchPieChart(activeDashTab);
}

/* ---- Small inline icon helper: the dashboard's own headline stat
   icons use crisp inline SVG (subset below) instead of Font Awesome
   glyph classes, since these sit large and directly on tinted card
   backgrounds where a glyph's exact stroke weight/alignment matters
   more than in a small inline-text context elsewhere in the app. The
   rest of the app keeps using Font Awesome classes unchanged. Falls
   back to an empty string for an unknown name — never renders a
   broken/missing icon.

   SOURCE OF TRUTH: every path below is copied verbatim from the
   installed lucide-static package (MIT-licensed, npm) for the outline
   glyphs, and simple-icons (CC0-licensed, npm) for the WhatsApp brand
   mark — not hand-drawn from memory. An earlier pass of this file HAD
   hand-drawn several of these (coins, graduation-cap, bell, users,
   building, tree) and every single one of those six was subtly wrong —
   e.g. "coins" rendered as an unrelated database-cylinder shape. Never
   hand-roll icon path data again in this file; pull from a real,
   verified icon package instead, even for something that looks simple
   enough to sketch by hand. ---- */
const DASH_ICONS = {
  // stroke-style outline icons (lucide-static) — rendered via the
  // shared stroke="currentColor" fill="none" template in dashIcon().
  coins: { style: 'stroke', body: '<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/>' },
  'triangle-alert': { style: 'stroke', body: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
  'graduation-cap': { style: 'stroke', body: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>' },
  sun: { style: 'stroke', body: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' },
  users: { style: 'stroke', body: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>' },
  bell: { style: 'stroke', body: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>' },
  'check-circle': { style: 'stroke', body: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>' },
  globe: { style: 'stroke', body: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>' },
  building: { style: 'stroke', body: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>' },
  tree: { style: 'stroke', body: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>' },
  clock: { style: 'stroke', body: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' },
  // solid-fill brand mark (simple-icons) — brand marks are conventionally
  // rendered as a single filled path, not stroke-outline like the
  // generic glyphs above; dashIcon() below switches templates by style
  // rather than forcing this into the stroke-icon markup.
  whatsapp: { style: 'fill', body: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' },
};
function dashIcon(name, size = 16, extraStyle = '') {
  const def = DASH_ICONS[name];
  if (!def) return '';
  const commonStyle = `display:inline-block;vertical-align:-2px;flex-shrink:0;${extraStyle}`;
  if (def.style === 'fill') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" style="${commonStyle}">${def.body}</svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${commonStyle}">${def.body}</svg>`;
}

/* ---- Branch snapshot row: replaces the old duplicate branch cards —
   one compact row per branch with a proportional bar instead of a
   second full stat-card grid restating student/teacher/revenue counts
   that the primary metrics below already cover in aggregate. ---- */
function branchSnapshotRow(label, studentCount, teacherCount, expected, color, maxStudents) {
  const pct = maxStudents > 0 ? Math.max(4, Math.round((studentCount / maxStudents) * 100)) : 0;
  return `
<div>
  <div class="flex items-center justify-between mb-1.5">
    <span class="text-sm font-bold" style="color:var(--text-strong);">${label}</span>
    <span class="text-xs" style="color:var(--text-muted);">${studentCount} şagird · ${teacherCount} müəllim · ${fmt(expected)}</span>
  </div>
  <div class="h-2 rounded-full overflow-hidden" style="background:var(--surface-soft);">
    <div class="h-full rounded-full" style="width:${pct}%;background:${color};"></div>
  </div>
</div>`;
}

/* ---- Primary metric card: the large, headline-weight cards. Visually
   distinct from secondary counts via size and an optional sublabel for
   extra context (e.g. "${n} ödəniş" under the debt total) instead of
   cramming a second number into the headline itself. ---- */
function primaryMetricCard(title, value, iconName, fg, bg, border, sublabel) {
  return `<div class="rounded-3xl p-5 sm:p-6" style="background:${bg};border:1.5px solid ${border};">
  <div class="flex items-center justify-between mb-3">
    <p class="eyebrow" style="color:${fg};opacity:.85;">${title}</p>
    <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:rgba(255,255,255,.6);color:${fg};">${dashIcon(iconName, 18)}</div>
  </div>
  <p class="text-3xl sm:text-[32px] font-bold font-head" style="color:${fg};">${value}</p>
  ${sublabel ? `<p class="text-xs mt-1 font-semibold" style="color:${fg};opacity:.7;">${sublabel}</p>` : ''}
</div>`;
}

/* ---- Collection-rate card: the one genuinely new metric. Renders an
   em dash (not "0%") when nothing was due yet this month, so an empty
   state doesn't read as a bad one — and colors green/amber/red by
   actual rate rather than always using the same accent, since this
   number's whole job is to signal whether collection is on track. ---- */
function collectionRateCard(pct, collected, due) {
  if (pct === null) {
    return primaryMetricCard("Yığım Faizi (bu ay)", "—", 'coins', 'var(--text-muted)', 'var(--surface-soft)', 'var(--border)', "Hələ ödəniş tarixi yoxdur");
  }
  const fg = pct >= 80 ? 'var(--teal-700)' : pct >= 50 ? 'var(--gold-600)' : 'var(--red-700)';
  const bg = pct >= 80 ? 'var(--teal-50)' : pct >= 50 ? 'var(--gold-50)' : 'var(--red-50)';
  const border = pct >= 80 ? 'var(--teal-100)' : pct >= 50 ? 'var(--gold-100)' : 'var(--red-100)';
  return primaryMetricCard("Yığım Faizi (bu ay)", pct + "%", 'coins', fg, bg, border, `${fmt(collected)} / ${fmt(due)}`);
}

/* ---- Secondary metric card: smaller, flatter, for counts that support
   the primary row rather than compete with it. Icon+text sit side by
   side from sm: up, but stack vertically below that — at 3-per-row on
   a narrow phone width there isn't enough horizontal room for a fixed
   icon + gap + label without truncating the label (e.g. "TƏDRİS İLİ"
   clipping to "TƏ…"), so this switches to a centered icon-over-label
   layout under the sm: breakpoint instead of letting text hide. ---- */
function secondaryMetricCard(title, value, iconName, fg) {
  return `<div class="glass rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
  <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:var(--surface-soft);color:${fg};">${dashIcon(iconName, 16)}</div>
  <div class="min-w-0">
    <p class="text-lg font-bold font-head leading-none" style="color:var(--text-strong);">${value}</p>
    <p class="eyebrow mt-1" style="font-size:9px;">${title}</p>
  </div>
</div>`;
}

/* ---- Unified urgency group: replaces the old separate "due today/week/
   month" mini-stat strip PLUS a full duplicate card grid below it with
   one grouped, labeled list. Only the "Bu Gün" group gets the
   attention-drawing treatment (a single capped pulse via CSS class
   dashboard-pulse-today, not an infinite one) — everything else is
   flat, since not everything overdue is equally urgent and the old
   version pulsed all of it identically. ---- */
function urgencyGroup(label, subs, fg, bg, border, urgent) {
  if (!subs || subs.length === 0) return '';
  const total = subs.reduce((s, x) => s + (x.math?.studentPays || 0), 0);
  return `
<div class="mb-5 last:mb-0">
  <div class="flex items-center justify-between mb-2.5">
    <p class="text-xs font-bold uppercase tracking-wider" style="color:${fg};">${label}</p>
    <span class="text-xs font-semibold" style="color:var(--text-muted);">${subs.length} · ${fmt(total)}</span>
  </div>
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
    ${subs.map(sub => `
    <div class="${urgent ? 'dashboard-pulse-today' : ''} p-4 rounded-2xl" style="background:${bg};border:1px solid ${border};">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0 cursor-pointer" onclick="openStudentProfile('${sub.studentId}')">
          <p class="font-bold text-sm truncate" style="color:var(--text-strong);">${escapeHtml((sub.studentName || '') + ' ' + (sub.studentSurname || ''))} ${sub.enrollment === 'summer' ? '<span class="badge badge-amber" style="font-size:8px;">YAY</span>' : ''}</p>
          <p class="text-xs mt-1 truncate" style="color:var(--text-muted);">${escapeHtml(sub.subject || '')} · ${escapeHtml(sub.class || '')}${sub.branch ? ' · ' + BRANCH_LABEL[sub.branch] : ''}</p>
        </div>
      </div>
      <div class="flex justify-between items-center mt-3 gap-2">
        <span class="font-bold text-sm" style="color:${fg};">${fmt(sub.math?.studentPays || 0)}</span>
        <button onclick="event.stopPropagation();sendWhatsAppReminder('${sub.studentId}')" title="WhatsApp xatırlatma göndər" class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition" style="background:rgba(255,255,255,.6);color:var(--teal-700);">
          ${dashIcon('whatsapp', 12)}<span>Xatırlat</span>
        </button>
      </div>
    </div>`).join('')}
  </div>
</div>`;
}

/* ===== WHATSAPP REMINDER ===== */
function sendWhatsAppReminder(studentId) {
  const s = state.students[studentId]; if (!s) return;
  const subs = getStudentSubjects(s);
  const overdueSubs = subs.filter(sub => isOverdue(sub.paymentDate, sub.status));
  if (!overdueSubs.length) return toast('Bu şagirdin gecikmiş ödənişi yoxdur', 'info');
  const total = overdueSubs.reduce((sum, sub) => sum + computeSubjectMath(sub, state.teachers[sub.teacherId]).studentPays, 0);
  const subjectNames = overdueSubs.map(sub => sub.subject).join(', ');
  const parentName = s.parent || s.name || '';
  const msg = `Hörmətli ${parentName} xanım/cənab, ${s.name || ''} ${s.surname || ''} üçün ${subjectNames} fənnindən ${fmt(total)} məbləğindəki ödənişin tarixi keçib. Zəhmət olmasa ödənişi həyata keçirin. Məram Tədris Mərkəzi.`;
  const phone = ((s.phone1 || s.phone2 || '').replace(/\D/g, '')).slice(-9);
  if (!phone) return toast('Şagirdin telefon nömrəsi yoxdur', 'error');
  window.open(`https://wa.me/994${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function drawIncomeExpenseChart(income, expenses, students) {
  const ctx = $('chartIncomeExpense');
  if (!ctx) return;
  if (state.charts.ie) state.charts.ie.destroy();

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }

  const incomeByMonth = {};
  const expenseByMonth = {};
  months.forEach(m => { incomeByMonth[m] = 0; expenseByMonth[m] = 0; });

  students.forEach(s => {
    getStudentSubjects(s).forEach(sub => {
      if (sub.status === 'paid' && sub.paymentDate) {
        const m = monthKey(sub.paymentDate);
        if (m in incomeByMonth) {
          const math = computeSubjectMath(sub, state.teachers[sub.teacherId]);
          incomeByMonth[m] += math.studentPays;
        }
      }
    });
  });
  income.forEach(i => {
    if (i.date) { const m = monthKey(i.date); if (m in incomeByMonth) incomeByMonth[m] += Number(i.amount) || 0; }
  });
  expenses.forEach(e => {
    if (e.date) { const m = monthKey(e.date); if (m in expenseByMonth) expenseByMonth[m] += Number(e.amount) || 0; }
  });

  const isDark = document.documentElement.classList.contains('dark-mode');
  state.charts.ie = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.slice(2)),
      datasets: [
        { label: 'Gəlir', data: months.map(m => incomeByMonth[m]), backgroundColor: '#0d9488', borderRadius: 6 },
        { label: 'Xərc', data: months.map(m => expenseByMonth[m]), backgroundColor: '#c2410c', borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: isDark ? '#a6b0ac' : '#5b6b67', font: { weight: 'bold', size: 11 } } } },
      scales: {
        x: { ticks: { color: isDark ? '#7c8a86' : '#7c8a86' }, grid: { display: false } },
        y: { ticks: { color: isDark ? '#7c8a86' : '#7c8a86' }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,30,28,0.06)' } }
      }
    }
  });
}

function drawBranchPieChart(activeDashTab) {
  const ctx = $('chartBranchPie');
  if (!ctx) return;
  if (state.charts.pie) state.charts.pie.destroy();

  const all = Object.values(state.students || {});
  let labels, data, colors;
  if (activeDashTab === 'sheher' || activeDashTab === 'goynuk') {
    const reg = all.filter(s => s.branch === activeDashTab && studentEnrollmentType(s) === 'regular').length;
    const sum = all.filter(s => s.branch === activeDashTab && studentEnrollmentType(s) === 'summer').length;
    labels = ['Tədris ili', 'Yay kursu']; data = [reg, sum]; colors = ['#0d9488', '#d97706'];
  } else {
    const sheher = all.filter(s => s.branch === 'sheher').length;
    const goynuk = all.filter(s => s.branch === 'goynuk').length;
    labels = ['Şəhər', 'Göynük']; data = [sheher, goynuk]; colors = ['#0d9488', '#2563eb'];
  }

  const isDark = document.documentElement.classList.contains('dark-mode');
  state.charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: isDark ? '#142522' : '#ffffff', borderWidth: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#a6b0ac' : '#5b6b67', font: { weight: 'bold', size: 11 }, padding: 14 } } }
    }
  });
}
