/* ============ PERMISSIONS ============ */
// Delegated to window.RBAC (js/permissions.js) for enhanced RBAC.
// Legacy short names ('finance', 'ai', etc.) still work via RBAC's compat map.
/**
 * Returns true if the profile has an admin-level role.
 * Use this everywhere instead of role === 'admin' to also cover super_admin.
 */
function isAdminRole(profile) {
  const r = (profile || state.profile)?.role;
  return r === 'admin' || r === 'super_admin';
}

function can(perm) {
  if (window.RBAC) return RBAC.can(perm, state.profile);
  // Ultimate fallback (should never be reached)
  return isAdminRole();
}
// VIEW_PERMS: which permission is needed to access each view
const VIEW_PERMS = {
  teachers: 'teachers', finance: 'finance',
  attendance: 'attendance', schedule: 'schedule',
  users: 'users',
  'ai-finance': 'ai', 'ai-students': 'ai', 'ai-forecast': 'ai',
};
function normalizeProfile(p) {
  if (!p) return p;
  // Back-compat: old roles 'sheher'/'goynuk' → manager + branch
  if (p.role === 'sheher') { p.role = 'manager'; p.branch = 'sheher'; }
  if (p.role === 'goynuk') { p.role = 'manager'; p.branch = 'goynuk'; }
  // New combined codes from user form
  if (p.role === 'manager_sheher') { p.role = 'manager'; p.branch = 'sheher'; }
  if (p.role === 'manager_goynuk') { p.role = 'manager'; p.branch = 'goynuk'; }
  if (p.role === 'reception_sheher') { p.role = 'reception'; p.branch = 'sheher'; }
  if (p.role === 'reception_goynuk') { p.role = 'reception'; p.branch = 'goynuk'; }
  if (isAdminRole(p)) p.branch = 'all';
  return p;
}

