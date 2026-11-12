// tests/permissions.test.js
//
// Regression tests for js/permissions.js — the RBAC engine that decides
// what every role can see and do (students, finance, users, AI, etc).
// Flagged in the audit (Section 2.1) alongside compat.js as logic that
// should have tests: a bug here either silently over-grants access
// (a security hole) or silently under-grants it (a support ticket every
// time someone's role can't do something it should).
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERMISSIONS_PATH = path.join(__dirname, '..', 'js', 'permissions.js');

function loadRBAC() {
  // permissions.js reads window.state?.profile as a fallback and writes
  // window.RBAC = RBAC at the end — in a real browser `window` IS the
  // global object the script runs against. Pointing the sandbox's own
  // `window` property back at itself reproduces that same self-reference
  // before the script runs, so `window.RBAC = RBAC` actually lands.
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  const src = readFileSync(PERMISSIONS_PATH, 'utf8');
  vm.runInContext(src, ctx, { filename: PERMISSIONS_PATH });
  return ctx;
}

let ctx;
let RBAC;
beforeAll(() => {
  ctx = loadRBAC();
  RBAC = ctx.RBAC;
});

describe('RBAC.can — legacy permission name resolution', () => {
  it('resolves legacy short names (e.g. "finance") to their new dotted form', () => {
    const admin = { role: 'admin' };
    expect(RBAC.can('finance', admin)).toBe(true);
    expect(RBAC.can('finance.view', admin)).toBe(true);
  });

  it('an unmapped, unknown permission name is simply not found for anyone', () => {
    expect(RBAC.can('totally.made.up.permission', { role: 'admin' })).toBe(false);
  });
});

describe('RBAC.can — role scoping matches the documented catalogue', () => {
  it('admin and super_admin have every permission in the catalogue', () => {
    const allPerms = Object.keys(ctx.PERMISSION_CATALOG);
    for (const perm of allPerms) {
      expect(RBAC.can(perm, { role: 'admin' })).toBe(true);
      expect(RBAC.can(perm, { role: 'super_admin' })).toBe(true);
    }
  });

  it('teacher cannot access finance, users, or teacher-management permissions', () => {
    const teacher = { role: 'teacher' };
    expect(RBAC.can('finance.view', teacher)).toBe(false);
    expect(RBAC.can('finance.edit', teacher)).toBe(false);
    expect(RBAC.can('users.view', teacher)).toBe(false);
    expect(RBAC.can('teachers.edit', teacher)).toBe(false);
  });

  it('teacher CAN view students and manage their own attendance/exams', () => {
    const teacher = { role: 'teacher' };
    expect(RBAC.can('students.view', teacher)).toBe(true);
    expect(RBAC.can('attendance.edit', teacher)).toBe(true);
    expect(RBAC.can('exams.add', teacher)).toBe(true);
  });

  it('teacher cannot delete or add students (read-only + exam/attendance only)', () => {
    const teacher = { role: 'teacher' };
    expect(RBAC.can('students.add', teacher)).toBe(false);
    expect(RBAC.can('students.delete', teacher)).toBe(false);
  });

  it('reception can add/edit students but not delete them', () => {
    const reception = { role: 'reception' };
    expect(RBAC.can('students.add', reception)).toBe(true);
    expect(RBAC.can('students.edit', reception)).toBe(true);
    expect(RBAC.can('students.delete', reception)).toBe(false);
  });

  it('accountant is scoped to finance/reports and nothing about students or teachers', () => {
    const accountant = { role: 'accountant' };
    expect(RBAC.can('finance.view', accountant)).toBe(true);
    expect(RBAC.can('finance.delete', accountant)).toBe(true);
    expect(RBAC.can('students.view', accountant)).toBe(false);
    expect(RBAC.can('teachers.view', accountant)).toBe(false);
  });

  it('hr can manage teachers but has no finance or student access', () => {
    const hr = { role: 'hr' };
    expect(RBAC.can('teachers.add', hr)).toBe(true);
    expect(RBAC.can('teachers.edit', hr)).toBe(true);
    expect(RBAC.can('finance.view', hr)).toBe(false);
    expect(RBAC.can('students.view', hr)).toBe(false);
  });

  it('manager has broad operational access but not user/role management', () => {
    const manager = { role: 'manager' };
    expect(RBAC.can('students.delete', manager)).toBe(true);
    expect(RBAC.can('finance.edit', manager)).toBe(true);
    expect(RBAC.can('users.view', manager)).toBe(false);
    expect(RBAC.can('roles.edit', manager)).toBe(false);
  });

  it('an unrecognized role falls back to the reception permission set, not full/no access', () => {
    const weird = { role: 'some_future_role_not_yet_defined' };
    expect(RBAC.can('students.add', weird)).toBe(true);   // reception can
    expect(RBAC.can('finance.view', weird)).toBe(false);  // reception cannot
  });
});

describe('RBAC.can — custom roles override defaults', () => {
  it('a loaded custom role definition takes priority over DEFAULT_ROLE_PERMISSIONS for that role name', () => {
    RBAC.loadCustomRoles({
      teacher: { name: 'Custom Teacher', permissions: ['dashboard.view', 'finance.view'] },
    });
    const teacher = { role: 'teacher' };
    // Custom definition explicitly grants finance.view (unusual, but the
    // point is the override takes effect) ...
    expect(RBAC.can('finance.view', teacher)).toBe(true);
    // ...and no longer grants something the default set had, since the
    // custom list fully replaces rather than merges with the default.
    expect(RBAC.can('attendance.edit', teacher)).toBe(false);
    // Reset for any other tests in this file / future additions.
    RBAC.loadCustomRoles({});
  });
});

describe('RBAC.canAccessBranch', () => {
  it('admin and super_admin can access any branch regardless of their own branch field', () => {
    expect(RBAC.canAccessBranch('sheher', { role: 'admin', branch: 'goynuk' })).toBe(true);
    expect(RBAC.canAccessBranch('goynuk', { role: 'super_admin', branch: 'sheher' })).toBe(true);
  });

  it('a branch-scoped role can only access its own branch', () => {
    const managerSheher = { role: 'manager', branch: 'sheher' };
    expect(RBAC.canAccessBranch('sheher', managerSheher)).toBe(true);
    expect(RBAC.canAccessBranch('goynuk', managerSheher)).toBe(false);
  });

  it('branch:"all" grants access to any branch even for a non-admin role', () => {
    const specialCase = { role: 'manager', branch: 'all' };
    expect(RBAC.canAccessBranch('sheher', specialCase)).toBe(true);
    expect(RBAC.canAccessBranch('goynuk', specialCase)).toBe(true);
  });

  it('a multi-branch array grants access to exactly the listed branches', () => {
    const multi = { role: 'manager', branches: ['sheher'] };
    expect(RBAC.canAccessBranch('sheher', multi)).toBe(true);
    expect(RBAC.canAccessBranch('goynuk', multi)).toBe(false);
  });

  it('returns false when no profile is available at all', () => {
    expect(RBAC.canAccessBranch('sheher', null)).toBe(false);
  });
});
