# Məram Cloud Functions

Three callable functions, all under `functions/src/`:

| Function | Purpose | Who can call it |
|---|---|---|
| `geminiProxy` | Calls Gemini server-side; the API key never reaches the browser | Any active user with an AI permission (checked server-side against their real DB role) |
| `setUserActive` | Enables/disables a user's real Firebase Auth account (not just a DB flag) | admin / super_admin only |
| `deleteUserAccount` | Permanently deletes a user's Auth account + DB profile | admin / super_admin only |

Why these three specifically: they're the parts of the original audit that
**database rules alone cannot fix**, because they require the Admin SDK
(deleting/disabling real Auth accounts) or need to hide a secret from the
browser entirely (the Gemini key). Everything else stayed enforceable via
`database.rules.json`.

## One-time setup

You'll need the Firebase CLI and a Blaze-plan (pay-as-you-go) Firebase
project — Cloud Functions require billing to be enabled, even though
actual usage for a project this size will likely stay within the free
tier quota.

```bash
npm install -g firebase-tools
firebase login
firebase use meramdata   # your project ID from js/config.js
```

Install function dependencies:

```bash
cd functions
npm install
```

### Set the Gemini API key as a secret

Do **not** put the key in any committed file. Firebase Functions v2 uses
Secret Manager for this:

```bash
firebase functions:secrets:set GEMINI_API_KEY
# paste the key when prompted
```

This is also your moment to use a **freshly rotated** key — the old one
that was in `js/config.js` should be treated as burned regardless of
whether this project has been deployed anywhere, since it left your local
machine the moment it was shared for review.

## Local development (recommended before first deploy)

Run everything against the Firebase emulator suite instead of your real
project — no billing needed for this part, and nothing you do here
touches production data:

```bash
firebase emulators:start --only functions,database,auth
```

The emulator UI (usually `http://localhost:4000`) lets you watch function
logs and inspect emulated database/auth state live. Point your local
`index.html` at the emulator by adding, right after `firebase-init.js`
loads (temporarily, for local testing only):

```js
if (location.hostname === 'localhost') {
  db.useEmulator('localhost', 9000);
  auth.useEmulator('http://localhost:9099');
  functionsClient.useEmulator('localhost', 5001);
}
```

## Deploying

```bash
firebase deploy --only functions
```

Deploy rules and functions together once both are ready:

```bash
firebase deploy --only functions,database
```

## After deploying: two client-side things to double check

1. **`js/config.js` must no longer contain a `gemini.apiKey`.** It's been
   removed already in this update — if you ever add it back "temporarily"
   for testing, remember to remove it again before this is shared or
   deployed anywhere real.
2. **The region matters.** `onCall` functions default to `us-central1`.
   If you deploy to a different region for latency reasons (Azerbaijan is
   far from `us-central1`), update the client's `functionsClient` calls to
   specify the region, e.g. `firebase.app().functions('europe-west1')` in
   `js/firebase-init.js`, matching whatever you pick with `.region('...')`
   on each `onCall` definition in `functions/src/`.

## What's intentionally still client-side

- `resetAIUsageToday()` / `setAIDailyTotal()` — admin-only config actions,
  already gated by `database.rules.json` (`aiQuota/config` is
  admin-write-only). No secret involved, low risk, didn't need moving.
- Reading `aiQuota/usage` for the Settings dashboard display — a read,
  already scoped by rules, doesn't need to go through a function.

## What this still doesn't fix

- **Custom claims.** These functions still trust `users/{uid}/role` in
  the database for authorization (via `authHelpers.js`), same as the
  rules do. This is a deliberate, deferred decision — see
  `SECURITY_RULES_README.md` for the tradeoff discussion. Worth doing as
  a dedicated follow-up once the UX for "role changed, please sign in
  again" is designed properly.
- **Audit trail integrity for non-AI actions.** `geminiProxy` writes its
  own trustworthy audit entries now (the function knows the real caller
  identity), but every other `logAudit()` call in the app still runs
  client-side and could theoretically be forged by a compromised client
  session, same as before. Moving all mutations through functions would
  fix this fully, but that's a much larger rewrite than this pass.
