/* ========== ROLE-BASED CONTEXT BUILDER ========== */
function buildAIContext(scope) {
  const role = state.profile?.role || 'sheher';
  const branch = state.profile?.branch;
  const isAdmin = role === 'admin';

  const filterByBranch = (obj) => {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (isAdmin || v.branch === branch) out[k] = v;
    });
    return out;
  };

  const students = filterByBranch(state.students);
  const teachers = filterByBranch(state.teachers);
  const examResults = {};
  Object.entries(state.examResults || {}).forEach(([sid, res]) => {
    if (students[sid]) examResults[sid] = res;
  });

  const ctx = {
    role: ROLE_LABEL[role],
    branch: isAdmin ? 'Bütün filiallar' : BRANCH_LABEL[branch],
    studentsCount: Object.keys(students).length,
    teachersCount: Object.keys(teachers).length,
  };

  const financeFilter = (v) => isAdmin || v.branch === branch;
  if (scope === 'finance' && (isAdmin || can('finance'))) {
    ctx.income = Object.values(state.income || {}).filter(financeFilter);
    ctx.expenses = Object.values(state.expenses || {}).filter(financeFilter);
    ctx.salaries = Object.values(state.salaries || {}).filter(financeFilter);
    ctx.teachers = Object.values(teachers).map(t => ({
      name: t.name, branch: t.branch, salaryType: t.salaryType, salary: t.monthlySalary || t.salary
    }));
    ctx.students = Object.values(students).map(s => ({
      branch: s.branch, enrollmentType: s.enrollmentType,
      subjects: (s.subjects || []).map(sub => ({ subject: sub.subject, price: sub.price, status: sub.status }))
    }));
  } else if (scope === 'students') {
    ctx.students = Object.entries(students).map(([id, s]) => ({
      id, name: s.name, branch: s.branch, class: s.class,
      enrollmentType: s.enrollmentType, parent: s.parent,
      subjects: s.subjects || [],
      examResults: Object.values(examResults[id] || {}),
    }));
  } else if (scope === 'forecast' && (isAdmin || can('finance'))) {
    ctx.income = Object.values(state.income || {}).filter(financeFilter);
    ctx.expenses = Object.values(state.expenses || {}).filter(financeFilter);
    ctx.salaries = Object.values(state.salaries || {}).filter(financeFilter);
  } else if (scope === 'chat') {
    ctx.students = Object.entries(students).map(([id, s]) => ({
      id, name: s.name, branch: s.branch, class: s.class,
      enrollmentType: s.enrollmentType,
      subjects: (s.subjects || []).map(sub => ({ subject: sub.subject, price: sub.price, status: sub.status })),
    }));
    ctx.teachers = Object.values(teachers).map(t => ({ name: t.name, branch: t.branch, subject: t.subject }));
    if (isAdmin) {
      ctx.incomeTotal = Object.values(state.income || {}).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      ctx.expensesTotal = Object.values(state.expenses || {}).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    }
  }
  return ctx;
}

