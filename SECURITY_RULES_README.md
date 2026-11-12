# Firebase Realtime Database Rules — what changed and why

Two files were added: `database.rules.json` and `firebase.json`. Previously
the project had **no rules file at all**, which almost certainly means the
database is running on the Firebase default (`.read`/`.write: auth != null`)
or, if never set, is closed — worth checking in the console right now
regardless of these files.

## Architecture decision: no backend

This project intentionally does **not** use Cloud Functions or the Blaze
(pay-as-you-go) plan. That's a real constraint, not an oversight, and it
means a handful of findings from the original audit (#5, #7, #8, and the
custom-claims discussion) can only be *mitigated* from the client side,
not fully closed. Each one is called out explicitly below with what's
actually protecting you and what isn't. If that constraint ever changes,
those are the items to revisit first.

## ⚠️ Do this first, separately from the rules

The Gemini API key in `js/config.js` is a real, live key committed into the
project you shared. Treat it as compromised:
1. Rotate it in Google Cloud Console.
2. Add an HTTP referrer restriction to the new key (the config file's own
   comments tell you how).
3. Restrict Firebase Authorized Domains to your real domain.

None of that is related to the database rules below, but it's the same
severity of "do it today."

## What these rules enforce

Built directly from reading the app's actual `db.ref(...)` calls and the
RBAC catalogue in `js/permissions.js` — not a generic template.

- **Nothing is readable or writable without `auth != null`.** The previous
  state had no rules file, so every `/students`, `/finance`, `/teachers`,
  etc. read in `router.js` was only as safe as whatever default rule was on
  the project.
- **The caller's own `users/{auth.uid}` profile must have `active: true`**
  for almost every read/write. This closes issue #4 (deactivated users can
  still log in) at the data layer: even if someone deactivated client-side
  keeps a valid Auth session, the database itself stops answering them.
- **Branch scoping is enforced server-side**, not just via `filterByBranch()`
  in the client. A `manager`/`reception`/`accountant` can only write records
  where `record.branch` equals their own `users/{uid}/branch`. `admin` and
  `super_admin` bypass this (matching `branch: 'all'`).
- **Role-based write permission matches `js/permissions.js`**, e.g.:
  - `students`: admin/manager full CRUD in-branch; reception can create/edit
    but not delete (closes #10); teacher gets no write path at all (closes
    #9 for students).
  - `teachers`: admin/HR/manager only, in-branch (closes #12).
  - `finance`: admin/manager/accountant only (closes #15).
  - `schedule`: admin/manager only — reception/teacher lose write access
    despite having `schedule.view` (closes #13).
  - `examResults`: manager/reception/teacher can create/edit, but **delete
    is blocked for everyone except admin** (closes #14).
- **`users/{uid}/role`, `/branch`, and `/active` can only be changed by an
  existing admin/super_admin — never by the user themselves**, even though
  a user can write other parts of their own profile (`prefs`, `lastLogin`).
  This closes the privilege-escalation gap that trusting a DB-stored role
  otherwise opens up (see the "custom claims" discussion below).
- **`lastLogin` is now writable by the user on their own node**, and
  `js/auth.js` writes it on every successful login (closes #30 — the
  field existed in the UI but nothing ever populated it).
- **`audit` is create-only.** No update or delete path exists for anyone,
  admin included, through the client SDK — closes the silent-tampering half
  of #34. Entries must also declare `userId === auth.uid` and
  `role`/`branch` matching the caller's real profile, and a timestamp close
  to server time, so a forged audit entry claiming to be a different user
  or role is rejected outright.
- **`aiQuota/config/dailyTotal`**: admin-only write, bounded 1–100,000.
  **`aiQuota/usage/{date}/{branch}`**: any authenticated user in that branch
  can write (needed for the existing transaction-based increment), admins
  can write any branch.
- **`pendingPasswords/{uid}`**: readable/writable only by that user or an
  admin. This *restricts exposure* but does not fix the underlying design
  flaw — see below.

## What rules genuinely cannot fix (still needs code/architecture changes)

Realtime Database rules are a real, enforced security boundary, but they
can't replace application logic for everything the original audit raised.
**Update: the items below marked ✅ have since been fixed in the app code
itself** (not just the rules) — see the change list further down.

- ✅ **Plaintext passwords (#6) — FIXED.** The `pendingPasswords` mechanism
  has been removed entirely from the app (`js/admin.js`, `views/users.js`).
  Admin password resets now only use Firebase's `sendPasswordResetEmail()`.
  The `pendingPasswords` node was also removed from the rules, so even old
  leftover data there is now unreadable/unwritable by anyone. **If your
  live database still has old `pendingPasswords/{uid}` entries with
  plaintext passwords in them, delete that node manually in the Firebase
  Console — the rules block new access to it, but existing data doesn't
  delete itself.**
- ✅ **Deactivated users can still log in (#4) — FIXED.** `js/auth.js` now
  checks `profile.active === false` right after loading the profile and
  signs the user back out immediately if so, in addition to the database
  rules blocking their reads/writes.
- ✅ **`lastLogin` never updated (#30) — FIXED.** Written on every
  successful login now.
- ✅ **Stored XSS (#19, #20, #21) — FIXED.** Every flagged unescaped
  interpolation (`s.note`, `s.name`/`surname`, `sub.subject`, exam
  `examName`/`note`/`rank`, audit `entity`/`details`/`userEmail`,
  `aiErrorHTML`) now goes through `escapeHtml()`. A broader sweep also
  caught two spots the audit didn't list (schedule room filter dropdown,
  branch name dropdown) that had the same gap.
- ✅ **Auth account deletion / true user deactivation (#5) — FIXED, once deployed.**
  `functions/src/userAdmin.js` (`setUserActive`, `deleteUserAccount`) now
  disables/deletes the actual Firebase Auth account via the Admin SDK, not
  just the database profile. `firebase.json` now includes a `functions`
  block so `firebase deploy` actually publishes them (previously it
  didn't), and `views/users.js` calls them via `httpsCallable` first. If
  these functions are **not yet deployed** for a given project, the
  frontend detects that (`functions/not-found` etc.) and falls back to
  the old client-only soft-delete behavior automatically, with a visible
  toast noting the Auth account was NOT touched in that fallback case —
  so nothing breaks mid-migration, but the gap only fully closes once
  `firebase deploy --only functions` has actually been run.
- ✅ **Gemini key exposure (#7) — FIXED, once deployed.**
  `functions/src/geminiProxy.js` now holds the Gemini key server-side
  (via a Secret Manager secret) and `js/ai/gemini.js` calls it through
  `firebase.functions().httpsCallable('geminiProxy')` first. Same
  deploy-dependent fallback as above: if the function isn't deployed,
  calls fall back to the original direct-from-browser Gemini call using
  the key in `js/config.js`, with the same referrer-restriction caveats
  as before. **Deploy `functions/` to actually close this gap** — merely
  having the code in the repo does not, by itself, protect the key.
- ✅ **AI quota enforcement (#8) — FIXED, once deployed.** Same proxy:
  `geminiProxy.js` enforces the daily quota with a real, atomic,
  server-side transaction (with rollback if the Gemini call itself
  fails), instead of the client-trusted counter. The client-side counter
  in `js/ai/gemini.js` is kept only as the fallback path's mechanism —
  see #7 above.
- ✅ **Custom claims vs. DB-stored role — FIXED, once deployed.**
  `database.rules.json` now checks `auth.token.role` / `auth.token.branch`
  (Firebase Auth custom claims) instead of reading
  `users/{uid}/role` / `users/{uid}/branch` out of the database for every
  authorization decision. `functions/src/customClaims.js` is a new
  Realtime Database trigger that mirrors `role`/`branch` onto the user's
  custom claims automatically whenever they change (and a `resyncMyClaims`
  callable for forcing an immediate resync — `views/users.js` calls it
  right after an admin edits another user's role/branch, to shrink the
  propagation window instead of waiting for that user's token to refresh
  naturally). This removes the database from the trust chain for role and
  branch: a rules bug or a compromised admin *account* can no longer
  alone grant a privilege escalation, since claims are only ever set by
  this trusted server-side code path.

  **Deliberately NOT part of this migration: `active`.** Custom claims
  only take effect once a client's ID token refreshes — up to ~1hr by
  default, or on an explicit `getIdToken(true)` call. `active` needs to
  take effect *instantly* on deactivation (that's the whole point of
  `setUserActive()`, see finding #5 above), so every rule still checks
  `root.child('users').child(auth.uid).child('active').val()` from the
  database directly, unchanged. Only `role`/`branch` moved to claims.
  `js/auth.js` force-refreshes the ID token on every login (and after
  the first-admin bootstrap) so a role change made while a user was
  logged out takes effect immediately on their next session, without
  waiting for the natural refresh cycle.

  **This one requires the migration to actually be deployed to take
  effect** — same caveat as the other Cloud-Functions-dependent items
  above. Until `firebase deploy --only database,functions` has been run
  for a given project, no user has a `role`/`branch` custom claim yet,
  so every `auth.token.role`/`auth.token.branch` check in the rules
  would evaluate to `null`/`undefined` and fail closed (nobody would
  have any role-based access at all) — **do not deploy the new
  `database.rules.json` before the `customClaims` functions have run at
  least once for every existing user.** The straightforward path: deploy
  `functions` first, then for each existing user either have them log
  out and back in (the `syncUserClaims`/`syncBranchClaims` triggers only
  fire on a *change* to `role`/`branch`, so an unchanged value won't
  trigger them retroactively) — or, simpler, call `resyncMyClaims` once
  per existing uid (e.g. from the Firebase Functions shell) to backfill
  claims for accounts that existed before this migration, *before*
  deploying the new rules. A ready-made script for exactly that now
  exists: `functions/scripts/backfill-claims.js` (run via
  `npm run backfill-claims` from the `functions/` directory) — it walks
  every existing Firebase Auth user, reads their `users/{uid}` DB
  profile, and sets matching custom claims for each one. Idempotent and
  safe to re-run. See that script's header comment and the exact deploy
  order in "Deploying" below.

## Deploying

If you don't have the Firebase CLI yet:

```bash
npm install -g firebase-tools
firebase login
```

This project is now on the Blaze (pay-as-you-go) plan requirement for
Cloud Functions — confirm that's enabled for the Firebase project in
the console before deploying functions (`firebase deploy --only functions`
will fail with a clear error if it isn't).

Set the Gemini API key as a Cloud Functions secret (this is what keeps
it out of the browser — do this once per project):

```bash
firebase functions:secrets:set GEMINI_API_KEY
# paste the key when prompted — it is stored in Secret Manager, not in
# any file in this repo
```

From the project root (where `firebase.json` now lives):

```bash
firebase use meramdata          # your Firebase project ID from config.js
```

**If this is the FIRST time deploying the custom-claims migration**
(i.e. `database.rules.json` on this Firebase project still has the old
`root.child('users')...role` checks), the order below matters — deploying
the new rules before every existing user has a claim would lock
everyone, including admins, out of the database entirely:

```bash
# 1. Deploy functions FIRST — this is what CAN set claims going forward,
#    but existing users don't have claims yet until step 2.
firebase deploy --only functions

# 2. Backfill claims for every user who already existed before this
#    migration (new users created after step 1 already get claims
#    automatically, via the syncUserClaims/syncBranchClaims triggers —
#    this step is only needed once, for the existing user base).
cd functions
npm run backfill-claims
cd ..

# 3. Only now is it safe to deploy the new claims-based rules.
firebase deploy --only database
```

**On every deploy after that first one** (functions and rules already
in sync, no pending migration), the simpler combined command is fine:

```bash
firebase deploy --only database,functions
```

That deploys the rules **and** the Cloud Functions (`geminiProxy`,
`setUserActive`, `deleteUserAccount`) together — it won't touch hosting.

Before deploying hosting, run:

```bash
npm install                        # once, to get vitest/eslint/etc
npm run predeploy                  # sw:build + sri:check + lint + test, in order
```

`npm run predeploy` runs `scripts/build-sw-precache.mjs` (regenerates
`sw-precache-manifest.json` so the offline app-shell service worker,
`sw.js`, knows about every current local file and gets a fresh cache
version — see that script's header comment), `sri:check` (verifies the
CDN `<script>`/`<link>` tags in `index.html` have real, currently-valid
SRI hashes — run `npm run sri:update` locally first, once, to pin real
hashes at all; this sandboxed build environment couldn't reach those
CDN hosts to compute them itself), lint, and the test suite. If all of
that passes:

```bash
firebase deploy --only hosting
```

You can also paste `database.rules.json`'s contents directly into
**Firebase Console → Realtime Database → Rules → Editor**, click "Publish."
The console will flag any syntax errors before you publish, which is a good
sanity check even if you deploy via CLI.

### Before you deploy: test with existing accounts

The Firebase Console rules simulator (same page as the rules editor) lets
you test specific paths against specific `auth.uid` values before going
live. Given how many roles this app has, I'd suggest simulating at least:
one `admin`, one `manager`, one `reception`, and one `teacher` account
against a write to `students/{someId}` and `finance/income/{someId}` to
confirm the branch/role logic behaves as expected against your real data
before publishing broadly.
