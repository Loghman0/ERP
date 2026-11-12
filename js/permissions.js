/**
 * RBAC — Role-Based Access Control Engine (Phase 3)
 *
 * Replaces the simple inline PERMS object in app.html with a
 * comprehensive, extensible, 30-permission system that retains
 * full backward compatibility with existing can() call sites.
 *
 * Usage (after this file is loaded):
 *   can('finance')           ← legacy name, still works
 *   can('finance.view')      ← new granular name
 *   RBAC.can('users.add')    ← direct RBAC call
 */

/* =========================================================
   Full Permission Catalogue  (module.action)
   ========================================================= */
const PERMISSION_CATALOG = {
    // Dashboard
    'dashboard.view': 'Dashboard',
    // Students
    'students.view': 'Şagirdlər — Bax',
    'students.add': 'Şagirdlər — Əlavə',
    'students.edit': 'Şagirdlər — Redaktə',
    'students.delete': 'Şagirdlər — Sil',
    'students.export': 'Şagirdlər — İxrac',
    // Attendance
    'attendance.view': 'Davamiyyət — Bax',
    'attendance.edit': 'Davamiyyət — Dəyiş',
    // Schedule
    'schedule.view': 'Cədvəl — Bax',
    'schedule.edit': 'Cədvəl — Dəyiş',
    // Teachers / Staff
    'teachers.view': 'Kadrlar — Bax',
    'teachers.add': 'Kadrlar — Əlavə',
    'teachers.edit': 'Kadrlar — Redaktə',
    'teachers.delete': 'Kadrlar — Sil',
    // Exams
    'exams.view': 'İmtahan — Bax',
    'exams.add': 'İmtahan — Əlavə',
    'exams.delete': 'İmtahan — Sil',
    // Finance
    'finance.view': 'Maliyyə — Bax',
    'finance.add': 'Maliyyə — Əlavə',
    'finance.edit': 'Maliyyə — Redaktə',
    'finance.delete': 'Maliyyə — Sil',
    // Reports & Export
    'reports.view': 'Hesabatlar — Bax',
    'reports.export': 'Hesabatlar — İxrac',
    // AI Features
    'ai.view': 'AI Analiz — Bax',
    'ai.chat': 'AI Chat — İstifadə',
    // User Management
    'users.view': 'İstifadəçilər — Bax',
    'users.add': 'İstifadəçilər — Əlavə',
    'users.edit': 'İstifadəçilər — Redaktə',
    'users.delete': 'İstifadəçilər — Sil',
    // Roles & Permissions
    'roles.view': 'Rollar — Bax',
    'roles.edit': 'Rollar — Dəyiş',
    // Branches
    'branches.view': 'Filiallar — Bax',
    'branches.edit': 'Filiallar — Dəyiş',
    // Settings
    'settings.view': 'Parametrlər — Bax',
    'settings.edit': 'Parametrlər — Dəyiş',
    // Subjects (Tədris ili / Yay Kursu fənləri) — separate from settings.edit
    // so managers can manage subjects without getting broader settings access.
    'subjects.edit': 'Fənlər — Əlavə/Sil',
    // Backup & Audit
    'backup.export': 'Backup — İxrac',
    'backup.import': 'Backup — İdxal',
    'audit.view': 'Audit Log — Bax',
    // Notifications
    'notifications.view': 'Bildirişlər',
    // SMS / WhatsApp (reserved)
    'sms.send': 'SMS Göndər',
    'whatsapp.send': 'WhatsApp Göndər',
};

/* =========================================================
   Default Role → Permission Mappings
   ========================================================= */
const _ALL = Object.keys(PERMISSION_CATALOG);

const DEFAULT_ROLE_PERMISSIONS = {
    // Super Admin — everything (set by Super Admin panel, not tenant)
    super_admin: _ALL,

    // Admin — everything within their tenant
    admin: _ALL,

    // Manager — operational, no user/role/system management
    manager: [
        'dashboard.view',
        'students.view', 'students.add', 'students.edit', 'students.delete', 'students.export',
        'attendance.view', 'attendance.edit',
        'schedule.view', 'schedule.edit',
        'teachers.view', 'teachers.add', 'teachers.edit',
        'exams.view', 'exams.add',
        'finance.view', 'finance.add', 'finance.edit',
        'reports.view', 'reports.export',
        'ai.view', 'ai.chat',
        'branches.view',
        'settings.view',
        'subjects.edit',
        'backup.export',
        'notifications.view',
    ],

    // Reception — student intake + attendance, no finance/teachers
    reception: [
        'dashboard.view',
        'students.view', 'students.add', 'students.edit',
        'attendance.view', 'attendance.edit',
        'schedule.view',
        'exams.view', 'exams.add',
        'ai.chat',
        'notifications.view',
    ],

    // Teacher — read-only students, own attendance, exams
    teacher: [
        'dashboard.view',
        'students.view',
        'attendance.view', 'attendance.edit',
        'schedule.view',
        'exams.view', 'exams.add',
        'notifications.view',
    ],

    // Accountant — finance only
    accountant: [
        'dashboard.view',
        'finance.view', 'finance.add', 'finance.edit', 'finance.delete',
        'reports.view', 'reports.export',
        'notifications.view',
    ],

    // HR — staff management
    hr: [
        'dashboard.view',
        'teachers.view', 'teachers.add', 'teachers.edit',
        'reports.view',
        'notifications.view',
    ],
};

/* =========================================================
   Legacy Backward-Compatibility Map
   Maps old short perm names → new module.action names
   ========================================================= */
const LEGACY_PERM_MAP = {
    students: 'students.view',
    exams: 'exams.view',
    payments: 'finance.view',
    teachers: 'teachers.view',
    subjects: 'subjects.edit',
    finance: 'finance.view',
    ai: 'ai.view',
    aiChat: 'ai.chat',
    export: 'reports.export',
    users: 'users.view',
    audit: 'audit.view',
    attendance: 'attendance.view',
    schedule: 'schedule.view',
};

/* =========================================================
   RBAC Engine
   ========================================================= */
const RBAC = {
    /** Full permission catalogue */
    ALL_PERMISSIONS: PERMISSION_CATALOG,

    /** Default role definitions */
    DEFAULT_ROLES: DEFAULT_ROLE_PERMISSIONS,

    /** Custom roles loaded from DB (keyed by roleId) */
    _customRoles: {},

    /** Load custom roles from the database */
    loadCustomRoles(rolesObj) {
        this._customRoles = rolesObj || {};
    },

    /**
     * Get the permission list for a role.
     * Checks custom roles first, then falls back to defaults.
     */
    getPermissionsForRole(role) {
        if (this._customRoles[role]) {
            return this._customRoles[role].permissions || [];
        }
        return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.reception;
    },

    /**
     * Check if a profile has a given permission.
     * Accepts both legacy names ('finance') and new names ('finance.view').
     * @param {string} perm - permission to check
     * @param {object} profile - user profile (uses window.state.profile if omitted)
     */
    can(perm, profile) {
        const p = profile || window.state?.profile;
        const role = p?.role || 'reception';
        // Resolve legacy permission name
        const resolved = LEGACY_PERM_MAP[perm] || perm;
        return this.getPermissionsForRole(role).includes(resolved);
    },

    /**
     * Check branch access: can the user see data for a given branch?
     */
    canAccessBranch(branch, profile) {
        const p = profile || window.state?.profile;
        if (!p) return false;
        if (p.role === 'admin' || p.role === 'super_admin') return true;
        if (p.branch === 'all') return true;
        // Multi-branch access
        if (Array.isArray(p.branches)) return p.branches.includes(branch);
        return p.branch === branch;
    },

    /**
     * Get readable label for a role
     */
    roleLabel(role) {
        const labels = {
            super_admin: 'SUPER ADMIN', admin: 'ADMIN', manager: 'MÜDİR',
            reception: 'RECEPTION', teacher: 'MÜƏLLİM',
            accountant: 'MUHASİB', hr: 'HR',
        };
        if (labels[role]) return labels[role];
        if (this._customRoles[role]) return (this._customRoles[role].name || role).toUpperCase();
        return role.toUpperCase();
    },

    /** Returns permission groups for UI rendering */
    getPermissionGroups() {
        return [
            { group: 'Şagirdlər', perms: ['students.view', 'students.add', 'students.edit', 'students.delete', 'students.export'] },
            { group: 'Davamiyyət', perms: ['attendance.view', 'attendance.edit'] },
            { group: 'Cədvəl', perms: ['schedule.view', 'schedule.edit'] },
            { group: 'Kadrlar', perms: ['teachers.view', 'teachers.add', 'teachers.edit', 'teachers.delete'] },
            { group: 'İmtahan', perms: ['exams.view', 'exams.add', 'exams.delete'] },
            { group: 'Maliyyə', perms: ['finance.view', 'finance.add', 'finance.edit', 'finance.delete'] },
            { group: 'AI', perms: ['ai.view', 'ai.chat'] },
            { group: 'İstifadəçilər', perms: ['users.view', 'users.add', 'users.edit', 'users.delete'] },
            { group: 'Rollar', perms: ['roles.view', 'roles.edit'] },
            { group: 'Filiallar', perms: ['branches.view', 'branches.edit'] },
            { group: 'Hesabat & İxrac', perms: ['reports.view', 'reports.export'] },
            { group: 'Parametrlər', perms: ['settings.view', 'settings.edit', 'subjects.edit'] },
            { group: 'Backup & Audit', perms: ['backup.export', 'backup.import', 'audit.view'] },
            { group: 'Digər', perms: ['notifications.view', 'sms.send', 'whatsapp.send'] },
        ];
    },
};

window.RBAC = RBAC;
window.PERMISSION_CATALOG = PERMISSION_CATALOG;
window.DEFAULT_ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;
