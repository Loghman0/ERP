// eslint.config.mjs
//
// Catches the class of bug this codebase is most exposed to given its
// architecture (see audit Section 2.1 / 2.5): no build step, no module
// system, 25+ ordered <script> tags sharing one global namespace by
// convention rather than by any enforced boundary. The most useful
// things a linter can do here are (a) catch a genuinely undefined
// reference — a typo, a function that got renamed in one file but not
// its call sites elsewhere — and (b) catch obviously dead code
// (unused vars) that tends to accumulate when refactors touch one file
// at a time. It is NOT trying to enforce a style guide or restructure
// the app's browser-global architecture; see eslint.app-globals.mjs for
// why the globals list below exists at all.
import js from '@eslint/js';
import { collectAppGlobals } from './eslint.app-globals.mjs';

const browserGlobals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly',
  console: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', location: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
  FileReader: 'readonly', FormData: 'readonly', AudioContext: 'readonly',
  webkitAudioContext: 'readonly', alert: 'readonly', confirm: 'readonly',
  prompt: 'readonly', requestAnimationFrame: 'readonly', Event: 'readonly',
  CustomEvent: 'readonly', history: 'readonly',
};

const thirdPartyGlobals = {
  // CDN libraries loaded as plain globals in index.html — see that
  // file's <script> tags. Listed explicitly (rather than a blanket
  // eslint-disable) so a typo like `firebae.auth()` still gets caught.
  firebase: 'readonly',
  Chart: 'readonly',
  flatpickr: 'readonly',
  XLSX: 'readonly',
  jspdf: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'views/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // these are plain <script> tags, not modules
      globals: {
        ...browserGlobals,
        ...thirdPartyGlobals,
        ...collectAppGlobals(),
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        args: 'none', // most callback params (e, snap, err) are conventional, not bugs
        varsIgnorePattern: '^_', // explicit "_" or "_prefixed" = intentionally unused
        caughtErrorsIgnorePattern: '^_', // catch(_) / catch(_err) — deliberate, see no-empty note below
      }],
      // NOTE on the no-unused-vars warnings this still produces: many
      // top-level functions here (openStudentModal, deleteTeacher, etc)
      // are called only from `onclick="..."` attribute strings inside
      // template-literal HTML, which ESLint has no way to see as a
      // real call site — it can only see JS. Those warnings are false
      // positives, not lint debt to clean up; left as warnings (not
      // errors, and not suppressed) specifically so a genuinely dead
      // function still shows up in the same list for a human to check
      // by hand, rather than disappearing into a blanket rule-off.
      'no-undef': 'error', // the actual point of this config — catch real ReferenceErrors
      // Explicitly OFF (not just "not set" — js.configs.recommended
      // enables it, and flat config only overrides a rule if a later
      // block sets it explicitly). Every top-level `function`/`const` in
      // this codebase is, by design, declared once and used from other
      // files as a global (see file header) — but the SAME name is also
      // fed into `globals` above so cross-file call sites don't trigger
      // false no-undef errors. That combination makes every single
      // top-level declaration look like it "redeclares" its own global
      // to a script-sourceType linter, which isn't a real bug here, just
      // an artifact of not having a module system. A genuine accidental
      // double-declaration of the same name in ONE file is still a
      // problem worth catching — but only within that file, which
      // no-redeclare can't distinguish from the cross-file case in this
      // setup. Trade-off accepted; revisit if this app ever migrates to
      // ES modules (see audit Section 2.5).
      'no-redeclare': 'off',
      'no-dupe-keys': 'error',
      'no-fallthrough': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      // Empty catch blocks are a deliberate, repeated pattern in this
      // codebase for non-critical fire-and-forget writes (e.g.
      // localStorage.setItem, audit logging) where failure shouldn't
      // interrupt the user-facing action — see js/auth.js, js/utils.js.
      // A genuinely empty try WITHOUT a catch, or other real no-empty
      // cases, are still flagged; only the catch-block convention above
      // is allowed.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Service worker: runs in the ServiceWorkerGlobalScope, not a
    // normal browser window (no `window`/`document`) and not Node —
    // its own distinct global set. Kept separate from both the
    // js/**/views/** block above and the Node tooling block below.
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
      },
    },
  },
  {
    // Node-side tooling (tests, scripts, this config itself) — real ES
    // modules, real Node globals, not part of the browser bundle above.
    files: ['tests/**/*.js', 'scripts/**/*.mjs', 'eslint.config.mjs', 'eslint.app-globals.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'functions/**', // separate Node/CommonJS codebase with its own package.json and deploy lifecycle — not this app's browser bundle or Node tooling; lint it separately if desired (its package.json has no lint script currently, by design — Cloud Functions here are small and stable, see functions/src/*.js).
      'assets/**',
      'css/**',
      '*.min.js',
    ],
  },
];
