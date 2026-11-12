// eslint.app-globals.mjs
//
// This app has no module system — index.html loads ~25 <script> tags in
// order, and every top-level `function`, `const`, or `let` in each one
// becomes a global that every OTHER script file can also see and call
// (see index.html's own comments and README's file-list). That's a
// deliberate architectural choice documented elsewhere in this audit
// (Section 2.5), not something this lint config tries to fix — but it
// does mean a naive ESLint setup would flag hundreds of legitimate
// cross-file references as "no-undef" false positives.
//
// Rather than hand-maintain a globals list that immediately drifts out
// of sync with the actual files (and silently stops catching real bugs
// the moment someone adds a function and forgets to update the list),
// this scans the same files index.html actually loads and extracts
// their top-level declaration names automatically, every time lint
// runs. A REAL undefined-variable bug (a typo, a removed function still
// called somewhere) still gets caught, because it won't match anything
// actually declared in these files.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this in sync with the <script src="..."> list in index.html.
// (A stale entry here just means a removed file's old names briefly
// stay "known" — harmless. A MISSING entry means that file's exports
// aren't recognized elsewhere and real no-undef errors would appear at
// their call sites, which is a loud, obvious signal to fix this list.)
const APP_SCRIPT_FILES = [
  'js/config.js',
  'js/firebase-init.js',
  'js/state.js',
  'js/permissions.js',
  'js/rbac.js',
  'js/utils.js',
  'js/auth.js',
  'js/idle-timeout.js',
  'js/compat.js',
  'js/ai/knowledge.js',
  'js/ai/prompts.js',
  'js/ai/gemini.js',
  'js/ai/context.js',
  'views/dashboard.js',
  'views/students.js',
  'views/attendance.js',
  'views/teachers.js',
  'views/schedule.js',
  'views/finance.js',
  'views/info.js',
  'views/settings.js',
  'views/users.js',
  'views/ai/tools.js',
  'views/ai/chat.js',
  'js/admin.js',
  'js/router.js',
];

// Matches top-level (unindented) `function name(`, `const name =`,
// `let name =`, and `window.name = ` (this app declares a few globals
// that way instead of `const`, e.g. js/ai/prompts.js's MERAM_PROMPTS).
// Deliberately simple/regex-based rather than a real parser — this only
// needs to find declaration NAMES for the globals list, not validate
// syntax (eslint itself does that part).
const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)|^(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)|^window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm;

export function collectAppGlobals() {
  const names = new Set();
  for (const rel of APP_SCRIPT_FILES) {
    const abs = path.join(__dirname, rel);
    let src;
    try {
      src = readFileSync(abs, 'utf8');
    } catch {
      continue; // file listed above but missing on disk — skip quietly
    }
    let m;
    while ((m = DECL_RE.exec(src))) {
      const name = m[1] || m[2] || m[3];
      if (name) names.add(name);
    }
  }
  return Object.fromEntries([...names].map((n) => [n, 'writable']));
}
