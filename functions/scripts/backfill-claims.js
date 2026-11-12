#!/usr/bin/env node
/**
 * functions/scripts/backfill-claims.js
 * ---------------------------------------------------------------------
 * One-time migration helper for the custom-claims change in
 * database.rules.json (see SECURITY_RULES_README.md's "Custom claims
 * vs. DB-stored role" section for the full why).
 *
 * database.rules.json now authorizes every role/branch-gated action
 * using auth.token.role / auth.token.branch (Firebase Auth custom
 * claims) instead of reading users/{uid}/role directly. Those claims
 * are set by functions/src/customClaims.js's syncUserClaims /
 * syncBranchClaims triggers — but those triggers only fire on a WRITE
 * to users/{uid}/role or users/{uid}/branch. Every user who already
 * existed before this migration has a role/branch value that was set
 * BEFORE the trigger existed, so nothing will re-fire it for them
 * automatically. Deploying the new rules without running this first
 * would mean every existing user's auth.token.role is null/undefined,
 * and every rule would evaluate to false — nobody could read or write
 * anything, including admins.
 *
 * This script walks every user in Firebase Auth, and for each one
 * looks up their users/{uid} database profile and sets their custom
 * claims to match — the exact same logic customClaims.js's trigger
 * runs per-user, just applied once to everyone who already exists.
 *
 * SAFE TO RE-RUN: idempotent — setting claims to the same values twice
 * is a no-op the second time. Safe to run again after adding users
 * later too, though normally the trigger already covers that case (new
 * users get their claims set the first time role/branch is written,
 * i.e. at creation).
 *
 * USAGE (run from the functions/ directory, with the Firebase Admin
 * SDK able to authenticate — either GOOGLE_APPLICATION_CREDENTIALS set
 * to a service account key, or run via `firebase functions:shell` /
 * from an authenticated `gcloud`/`firebase` CLI session):
 *
 *   node scripts/backfill-claims.js
 *
 * Run this ONCE, after `firebase deploy --only functions` (so the
 * customClaims functions/triggers exist and will handle everyone
 * going forward) and BEFORE `firebase deploy --only database` deploys
 * the new claims-based rules.
 * ---------------------------------------------------------------------
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

function loadDatabaseUrl() {
  // firebase-admin needs an explicit databaseURL when run outside a
  // deployed Cloud Function (where it's normally injected automatically).
  // Reuse the same project's URL pattern as js/config.js — adjust here
  // if this project's Realtime Database is not in the default region.
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error(
      'Set GCLOUD_PROJECT or FIREBASE_PROJECT_ID (or run via `firebase functions:shell`, ' +
      'which sets this automatically) so this script knows which project/database to target.'
    );
    process.exit(1);
  }
  return `https://${projectId}-default-rtdb.firebaseio.com`;
}

async function main() {
  initializeApp({
    credential: applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL || loadDatabaseUrl(),
  });

  const auth = getAuth();
  const db = getDatabase();

  let backfilled = 0;
  let skippedNoProfile = 0;
  let failed = 0;
  let nextPageToken;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const userRecord of page.users) {
      const uid = userRecord.uid;
      try {
        const snap = await db.ref(`users/${uid}`).get();
        const profile = snap.val();
        if (!profile) {
          console.warn(`  skip ${uid} (${userRecord.email || 'no email'}): no users/${uid} DB profile found`);
          skippedNoProfile++;
          continue;
        }
        await auth.setCustomUserClaims(uid, {
          role: profile.role || null,
          branch: profile.branch || null,
        });
        console.log(`  ok   ${uid} (${userRecord.email || 'no email'}): role=${profile.role || 'null'} branch=${profile.branch || 'null'}`);
        backfilled++;
      } catch (err) {
        console.error(`  FAIL ${uid} (${userRecord.email || 'no email'}):`, err.message);
        failed++;
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log('\n--- Backfill complete ---');
  console.log(`Backfilled: ${backfilled}`);
  console.log(`Skipped (no DB profile): ${skippedNoProfile}`);
  console.log(`Failed: ${failed}`);

  if (skippedNoProfile > 0) {
    console.log(
      '\nUsers skipped above exist in Firebase Auth but have no matching ' +
      'users/{uid} database record — likely orphaned accounts from before ' +
      'this project started using setUserActive/deleteUserAccount for full ' +
      'cleanup. They will fail every claims-gated rule until they either get ' +
      'a real profile or are deleted from Auth directly.'
    );
  }
  if (failed > 0) {
    console.log('\nSome users failed — re-run this script after investigating (it is safe to re-run).');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
