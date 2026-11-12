/* ============ STATE ============ */
// Exposed on window so separately-loaded view scripts (e.g. views/users.js)
// and RBAC.can()'s default-profile lookup can read the logged-in user's state.
const state = window.state = {
  user: null,
  profile: null,
  students: {},
  teachers: {},
  income: {},
  expenses: {},
  examResults: {},   // {studentId: {resId: {...}}}
  attendance: {},    // {YYYY-MM-DD: {branch: {subjectId: {studentId: status}}}}
  schedule: {},      // {entryId: {teacherId, subjectId, day, start, end, room, branch}}
  audit: {},
  subjects: ["Riyaziyyat", "Azərbaycan Dili", "İngilis Dili", "Fizika", "Kimya", "Məntiq", "Biologiya", "Tarix", "Coğrafiya", "İnformatika"],
  summerSubjects: ["Kompüter kursu", "İngilis dili (yay)", "Riyaziyyat (yay)"],
  users: {},
  branchFilter: "all",
  currentView: "dashboard",
  studentEnrollmentFilter: "regular", // regular | summer
  studentTablePage: 1, // 1-indexed — see views/students.js's renderStudentTable pagination
  profileTab: "subjects",
  currentProfileId: null,
  charts: {},
};

const BRANCH_LABEL = { sheher: "Şəhər", goynuk: "Göynük", all: "Hamısı" };
const ROLE_LABEL = {
  admin: "ADMIN", manager: "MÜDİR", reception: "RECEPTION",
  teacher: "MÜƏLLİM", accountant: "MUHASİB", hr: "HR", super_admin: "SUPER ADMIN"
};
const CLASS_LABEL = {
  abituriyent: "Abituriyent", universitet: "Universitet",
  texnikum: "Texnikum", pese: "Peşə məktəbi", boyuk: "Böyük"
};
const SALARY_TYPE_LABEL = { fixed: "Sabit aylıq", hourly: "Saatlıq", revenue_share: "Şagird %-i" };
const STAFF_ROLE_LABEL = {
  teacher: "Müəllim", reception: "Reception", manager: "Menecer",
  admin: "Administrator", janitor: "Xadimə", other: "Digər"
};
const STAFF_ROLE_BADGE = {
  teacher: "badge-blue", reception: "badge-emerald", manager: "badge-purple",
  admin: "badge-red", janitor: "badge-amber", other: "badge-slate"
};
function staffRole(t) { return t.staffRole || 'teacher'; }
function isTeacherRole(t) { return staffRole(t) === 'teacher'; }

