/* ============ MIGRATION HELPERS (back-compat) ============ */
function getStudentSubjects(s) {
  if (Array.isArray(s.subjects) && s.subjects.length > 0) {
    return s.subjects.map(x => ({
      discount: 0, discountCoverage: 'course', ...x
    }));
  }
  if (s.subject) return [{
    subject: s.subject, teacherId: s.teacherId || null,
    paymentDate: s.paymentDate || '', price: s.price || 0,
    status: s.status || 'unpaid', discount: 0, discountCoverage: 'course'
  }];
  return [];
}

function teacherSalaryType(t) { return t.salaryType || 'fixed'; }
function teacherMonthlySalary(t) {
  const st = teacherSalaryType(t);
  if (st === 'fixed') return Number(t.monthlySalary ?? t.salary) || 0;
  return 0;
}
function studentEnrollmentType(s) { return s.enrollmentType || 'regular'; }

/* ============ PAYMENT MATH ============ */
// For a single subject-row of a student, returns:
// { gross, studentPays, teacherEarn, courseEarn }
function computeSubjectMath(sub, teacher) {
  const gross = Number(sub.price) || 0;
  const discount = Math.min(gross, Number(sub.discount) || 0);
  const studentPays = gross - discount;
  const cov = sub.discountCoverage || 'course';
  const st = teacher ? teacherSalaryType(teacher) : 'fixed';

  if (st !== 'revenue_share') {
    // teacher salary not tied to gross — discount only affects course income
    return { gross, discount, studentPays, teacherEarn: 0, courseEarn: studentPays, coverage: cov };
  }
  const pct = Math.max(0, Math.min(100, Number(teacher.teacherSharePct ?? 50))) / 100;
  const teacherBase = gross * pct;
  const courseBase = gross - teacherBase;
  let teacherEarn = teacherBase, courseEarn = courseBase;
  if (cov === 'teacher') teacherEarn -= discount;
  else if (cov === 'course') courseEarn -= discount;
  else if (cov === 'split') { teacherEarn -= discount / 2; courseEarn -= discount / 2; }
  // clamp
  teacherEarn = Math.max(0, teacherEarn);
  courseEarn = Math.max(0, courseEarn);
  return { gross, discount, studentPays, teacherEarn, courseEarn, coverage: cov };
}

