// tests/helpers/loadGlobalScript.js
//
// The app's js/*.js and views/*.js files are plain browser <script> tags —
// they declare top-level `function` statements that become globals, with
// no module.exports and no ES module syntax (see index.html's 25+ ordered
// <script src> tags). That's a deliberate zero-build-step choice for the
// app itself (see README), but it means these files can't be `import`ed
// directly by a test runner.
//
// Rather than rewrite compat.js into a module (which would mean the
// browser and the tests are no longer running the exact same file — the
// whole point of testing it), this loader reads the file's source and
// evaluates it with Node's vm module against a plain object, then hands
// back that object's own properties as named exports. This is the same
// trick `new Function(...)` tests elsewhere in this pass used to
// sanity-check syntax, just wired up to actually capture the declared
// functions afterward.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadGlobalScript(absPath, injectedGlobals = {}) {
  const src = readFileSync(absPath, 'utf8');
  const sandbox = { ...injectedGlobals };
  vm.createContext(sandbox);
  // Wrapping in `(function(){ ... }).call(this)` and assigning every
  // declared top-level function onto `this` afterward would require
  // parsing the file; simplest robust approach is running the script
  // directly in the sandbox context, where top-level `function foo(){}`
  // declarations attach directly to the context's global object.
  vm.runInContext(src, sandbox, { filename: absPath });
  return sandbox;
}
