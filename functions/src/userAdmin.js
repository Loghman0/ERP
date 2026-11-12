const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { requireAdmin } = require("./authHelpers");

/**
 * Sets a user's active/disabled state in BOTH Firebase Auth and the
 * database profile. Closes finding #4 (deactivated users could still
 * log in) at the source: db rules alone stop *database* access for a
 * deactivated user, and js/auth.js signs them out on next profile load,
 * but only this — disabling the Auth account itself — stops them from
 * completing sign-in at all, including on other devices with an
 * already-cached session.
 */
const setUserActive = onCall({ cors: true }, async (request) => {
  const { uid: callerUid, profile: callerProfile } = await requireAdmin(request);

  const { uid, active } = request.data || {};
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "istifadəçi ID tələb olunur.");
  }
  if (typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "'active' boolean olmalıdır.");
  }
  if (uid === callerUid && active === false) {
    throw new HttpsError("failed-precondition", "Öz hesabınızı deaktiv edə bilməzsiniz.");
  }

  const auth = getAuth();
  const db = getDatabase();

  // Auth is the source of truth for whether sign-in itself is possible;
  // the DB flag drives the rest of the app's UI/rules.
  await auth.updateUser(uid, { disabled: !active });
  await db.ref(`users/${uid}`).update({
    active,
    ...(active
      ? { reactivatedAt: Date.now(), reactivatedBy: callerUid }
      : { deactivatedAt: Date.now(), deactivatedBy: callerUid }),
  });

  await db.ref("audit").push({
    action: active ? "reactivate_user" : "deactivate_user",
    entity: "user",
    entityId: uid,
    details: "",
    userId: callerUid,
    userEmail: callerProfile.email || "",
    role: callerProfile.role || null,
    branch: callerProfile.branch || null,
    ts: Date.now(),
  });

  return { ok: true };
});

/**
 * Permanently deletes a user: the Firebase Auth account AND the database
 * profile. Closes finding #5 — the old client-side "delete" only ever
 * soft-deleted the DB record and left a fully functional Auth account
 * behind.
 */
const deleteUserAccount = onCall({ cors: true }, async (request) => {
  const { uid: callerUid, profile: callerProfile } = await requireAdmin(request);

  const { uid } = request.data || {};
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "istifadəçi ID tələb olunur.");
  }
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "Öz hesabınızı silə bilməzsiniz.");
  }

  const auth = getAuth();
  const db = getDatabase();

  const targetSnap = await db.ref(`users/${uid}`).get();
  const targetEmail = targetSnap.val()?.email || uid;

  // Delete Auth first — if this fails, we haven't destroyed the DB
  // record yet, so nothing is left half-consistent in the more
  // recoverable direction.
  try {
    await auth.deleteUser(uid);
  } catch (err) {
    // If the Auth user is already gone (e.g. manually removed in
    // console), proceed to clean up the DB record instead of blocking.
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "Auth hesabını silmək mümkün olmadı: " + err.message);
    }
  }

  await db.ref(`users/${uid}`).remove();

  await db.ref("audit").push({
    action: "delete_user",
    entity: "user",
    entityId: uid,
    details: targetEmail,
    userId: callerUid,
    userEmail: callerProfile.email || "",
    role: callerProfile.role || null,
    branch: callerProfile.branch || null,
    ts: Date.now(),
  });

  return { ok: true };
});

module.exports = { setUserActive, deleteUserAccount };
