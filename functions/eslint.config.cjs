// functions/eslint.config.cjs
//
// Separate, minimal lint config for the Cloud Functions codebase — this
// is real CommonJS Node code (not a browser bundle), so it gets Node
// globals and no-undef checking, without inheriting anything from the
// app's root eslint.config.mjs (see that file: functions/** is
// explicitly excluded from it, since these are two different runtimes
// with two different dependency trees and deploy lifecycles).
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly', // native in Node 18+; functions/package.json + firebase.json both target Node 20
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { ignores: ['node_modules/**'] },
];
