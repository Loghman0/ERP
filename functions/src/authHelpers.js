const { HttpsError } = require("firebase-functions/v2/https");
const { getDatabase } = require("firebase-admin/database");

/**
 * Loads the caller's profile from users/{uid} and throws if they don't
 * exist or are deactivated. This is intentionally the *only* place that
 * reads a caller's role for authorization decisions in these functions,
 * so every function enforces "active" the same way.
 *
 * Role/branch here come from request.auth.token (the caller's ID token
 * custom claims, set by functions/src/customClaims.js) when present,
 * falling back to the DB profile's role/branch for a caller whose token
 * hasn't picked up a very recent claims change yet (see customClaims.js
 * for why role/branch use claims but "active" deliberately does not —
 * the DB is still consulted for "active" specifically). The DB read
 * below is still required regardless, since "active" is never trusted
 * from a claim.
 */
async function loadCallerProfile(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Bu əməliyyat üçün daxil olmalısınız.");
  }
  const uid = request.auth.uid;
  const db = getDatabase();
  const snap = await db.ref(`users/${uid}`).get();
  const dbProfile = snap.val();
  if (!dbProfile) {
    throw new HttpsError("permission-denied", "İstifadəçi profili tapılmadı.");
  }
  if (dbProfile.active === false) {
    throw new HttpsError("permission-denied", "Hesabınız deaktiv edilib.");
  }
  // Prefer the token's claims (harder to forge than a DB value — see
  // customClaims.js) when present; fall back to the DB profile's role/
  // branch only for the brief window right after a role change, before
  // this caller's token has picked up the new claim.
  const profile = {
    ...dbProfile,
    role: request.auth.token?.role ?? dbProfile.role,
    branch: request.auth.token?.branch ?? dbProfile.branch,
  };
  return { uid, profile };
}

function isAdminRole(role) {
  return role === "admin" || role === "super_admin";
}

/**
 * Loads the caller's profile and throws unless they're admin/super_admin.
 * Use for functions that should only ever be admin-triggered
 * (user disable/delete, quota config, etc).
 */
async function requireAdmin(request) {
  const { uid, profile } = await loadCallerProfile(request);
  if (!isAdminRole(profile.role)) {
    throw new HttpsError("permission-denied", "Bu əməliyyat üçün admin səlahiyyəti tələb olunur.");
  }
  return { uid, profile };
}

module.exports = { loadCallerProfile, requireAdmin, isAdminRole };
