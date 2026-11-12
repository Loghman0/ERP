// tests/compat.test.js
//
// Regression tests for js/compat.js — specifically computeSubjectMath(),
// which is the single function that decides how much a student pays and
// how much a teacher earns per subject-row, across every discount and
// salary-type combination. This is exactly the kind of logic flagged in
// the audit (Section 2.1) as needing coverage: it directly drives money
// owed to teachers and by students, and previously had zero tests.
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGlobalScript } from './helpers/loadGlobalScript.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPAT_PATH = path.join(__dirname, '..', 'js', 'compat.js');

let compat;
beforeAll(() => {
  compat = loadGlobalScript(COMPAT_PATH);
});

describe('computeSubjectMath — non-revenue-share teachers (fixed/hourly/no teacher)', () => {
  it('with no discount, the student pays gross and 100% goes to course income', () => {
    const sub = { price: 100, discount: 0 };
    const teacher = { salaryType: 'fixed', monthlySalary: 800 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.gross).toBe(100);
    expect(r.discount).toBe(0);
    expect(r.studentPays).toBe(100);
    expect(r.teacherEarn).toBe(0); // fixed-salary teacher earns nothing per-subject
    expect(r.courseEarn).toBe(100);
  });

  it('discount reduces what the student pays, and courseEarn follows studentPays (not gross)', () => {
    const sub = { price: 100, discount: 30 };
    const teacher = { salaryType: 'hourly', hourlyRate: 15 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.studentPays).toBe(70);
    expect(r.courseEarn).toBe(70);
    expect(r.teacherEarn).toBe(0);
  });

  it('with no teacher record at all, still resolves (defaults to non-revenue-share math)', () => {
    const sub = { price: 100, discount: 0 };
    const r = compat.computeSubjectMath(sub, null);
    expect(r.teacherEarn).toBe(0);
    expect(r.courseEarn).toBe(100);
  });
});

describe('computeSubjectMath — revenue_share teachers', () => {
  it('splits gross by teacherSharePct with no discount', () => {
    const sub = { price: 200, discount: 0 };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 50 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(100);
    expect(r.courseEarn).toBe(100);
  });

  it('defaults to 50% split when teacherSharePct is not set', () => {
    const sub = { price: 200, discount: 0 };
    const teacher = { salaryType: 'revenue_share' };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(100);
    expect(r.courseEarn).toBe(100);
  });

  it('clamps an out-of-range teacherSharePct (>100) down to 100%', () => {
    const sub = { price: 200, discount: 0 };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 250 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(200);
    expect(r.courseEarn).toBe(0);
  });

  it('clamps a negative teacherSharePct up to 0%', () => {
    const sub = { price: 200, discount: 0 };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: -20 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(0);
    expect(r.courseEarn).toBe(200);
  });

  it('discountCoverage "teacher" takes the whole discount out of the teacher\'s share', () => {
    const sub = { price: 200, discount: 40, discountCoverage: 'teacher' };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 50 };
    const r = compat.computeSubjectMath(sub, teacher);
    // base split before discount: teacher 100, course 100
    expect(r.teacherEarn).toBe(60); // 100 - 40
    expect(r.courseEarn).toBe(100);
    expect(r.studentPays).toBe(160);
  });

  it('discountCoverage "course" takes the whole discount out of the course\'s share', () => {
    const sub = { price: 200, discount: 40, discountCoverage: 'course' };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 50 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(100);
    expect(r.courseEarn).toBe(60); // 100 - 40
  });

  it('discountCoverage "split" divides the discount evenly between teacher and course', () => {
    const sub = { price: 200, discount: 40, discountCoverage: 'split' };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 50 };
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBe(80); // 100 - 20
    expect(r.courseEarn).toBe(80);  // 100 - 20
  });

  it('never lets a large discount push teacherEarn or courseEarn below zero', () => {
    const sub = { price: 100, discount: 90, discountCoverage: 'teacher' };
    const teacher = { salaryType: 'revenue_share', teacherSharePct: 20 }; // teacher base = 20
    const r = compat.computeSubjectMath(sub, teacher);
    expect(r.teacherEarn).toBeGreaterThanOrEqual(0);
    expect(r.teacherEarn).toBe(0); // 20 - 90 clamped to 0, not negative
  });
});

describe('computeSubjectMath — input hardening', () => {
  it('treats a discount larger than the price as fully covering the price (never negative studentPays)', () => {
    const sub = { price: 100, discount: 500 };
    const r = compat.computeSubjectMath(sub, null);
    expect(r.studentPays).toBe(0);
    expect(r.discount).toBe(100); // clamped to gross, not the raw 500
  });

  it('coerces a non-numeric price to 0 instead of throwing or producing NaN', () => {
    const sub = { price: 'not-a-number', discount: 0 };
    const r = compat.computeSubjectMath(sub, null);
    expect(r.gross).toBe(0);
    expect(Number.isNaN(r.studentPays)).toBe(false);
    expect(r.studentPays).toBe(0);
  });

  it('coerces a missing/undefined discount to 0 rather than NaN', () => {
    const sub = { price: 100 };
    const r = compat.computeSubjectMath(sub, null);
    expect(r.discount).toBe(0);
    expect(r.studentPays).toBe(100);
  });
});

describe('getStudentSubjects — legacy single-subject migration', () => {
  it('returns the subjects array as-is (with discount defaults) when present', () => {
    const s = { subjects: [{ subject: 'Riyaziyyat', price: 50 }] };
    const subs = compat.getStudentSubjects(s);
    expect(subs).toHaveLength(1);
    expect(subs[0].subject).toBe('Riyaziyyat');
    expect(subs[0].discount).toBe(0);
    expect(subs[0].discountCoverage).toBe('course');
  });

  it('falls back to the legacy single s.subject field when subjects[] is absent', () => {
    const s = { subject: 'Fizika', price: 40, status: 'paid' };
    const subs = compat.getStudentSubjects(s);
    expect(subs).toHaveLength(1);
    expect(subs[0].subject).toBe('Fizika');
    expect(subs[0].status).toBe('paid');
  });

  it('returns an empty array for a student with neither subjects[] nor subject', () => {
    const subs = compat.getStudentSubjects({});
    expect(subs).toEqual([]);
  });
});

describe('teacherSalaryType / teacherMonthlySalary', () => {
  it('defaults to "fixed" when salaryType is unset', () => {
    expect(compat.teacherSalaryType({})).toBe('fixed');
  });

  it('reads monthlySalary, falling back to legacy "salary" field', () => {
    expect(compat.teacherMonthlySalary({ salaryType: 'fixed', monthlySalary: 900 })).toBe(900);
    expect(compat.teacherMonthlySalary({ salaryType: 'fixed', salary: 750 })).toBe(750);
  });

  it('returns 0 for non-fixed salary types (their pay comes from computeSubjectMath instead)', () => {
    expect(compat.teacherMonthlySalary({ salaryType: 'hourly', hourlyRate: 20 })).toBe(0);
    expect(compat.teacherMonthlySalary({ salaryType: 'revenue_share', teacherSharePct: 50 })).toBe(0);
  });
});
