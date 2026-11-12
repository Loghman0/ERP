#!/usr/bin/env node
/**
 * add-sri-hashes.mjs
 * ---------------------------------------------------------------------
 * Fetches every pinned third-party <script src> / <link rel="stylesheet">
 * referenced in index.html, computes its real SHA-384 Subresource
 * Integrity hash, and writes integrity="sha384-..." crossorigin="anonymous"
 * attributes onto the matching tag.
 *
 * WHY THIS SCRIPT EXISTS INSTEAD OF HARDCODED HASHES:
 * SRI hashes must match the exact bytes served by the CDN. Committing a
 * hash without being able to fetch and verify it against the live file
 * would be worse than no hash at all (a mismatched hash breaks the
 * script entirely — the browser refuses to execute it). This project's
 * sandboxed build environment could not reach cdn.jsdelivr.net,
 * cdnjs.cloudflare.com, or www.gstatic.com to compute real hashes, so
 * this script is provided to be run once, from a machine with normal
 * internet access, whenever a pinned CDN version changes.
 *
 * NOTE: cdn.tailwindcss.com is intentionally EXCLUDED — it's a runtime
 * JIT compiler that serves different generated CSS per request, so it
 * has no stable hash to pin. See README "Removing the Tailwind CDN
 * script" section for the real fix (a compiled Tailwind build).
 *
 * Usage:
 *   node scripts/add-sri-hashes.mjs            # updates index.html in place
 *   node scripts/add-sri-hashes.mjs --check     # verifies existing hashes, exits 1 on mismatch
 * ---------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = path.join(__dirname, '..', 'index.html');
const CHECK_ONLY = process.argv.includes('--check');

// Tags eligible for SRI: has a real src/href pointing at a versioned CDN
// URL, and isn't the Tailwind JIT script (excluded above).
const TAG_RE = /<(script|link)\b[^>]*\b(?:src|href)="(https:\/\/[^"]+)"[^>]*>/g;
const EXCLUDE_HOSTS_SUBSTRINGS = ['cdn.tailwindcss.com'];

async function sriFor(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha384').update(buf).digest('base64');
  return `sha384-${hash}`;
}

async function main() {
  let html = readFileSync(INDEX_HTML, 'utf8');
  const tags = [...html.matchAll(TAG_RE)];
  const results = [];
  let mismatches = 0;

  for (const m of tags) {
    const [fullTag, , url] = m;
    if (EXCLUDE_HOSTS_SUBSTRINGS.some((h) => url.includes(h))) continue;
    if (!/\/(npm|ajax\/libs|firebasejs)\//.test(url) && !/jsdelivr|cdnjs|gstatic/.test(url)) continue;

    process.stdout.write(`Hashing ${url} ... `);
    let integrity;
    try {
      integrity = await sriFor(url);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      continue;
    }
    console.log(integrity);

    const existingMatch = fullTag.match(/integrity="([^"]*)"/);
    if (CHECK_ONLY) {
      if (!existingMatch) {
        console.log(`  -> MISSING integrity attribute`);
        mismatches++;
      } else if (existingMatch[1] !== integrity) {
        console.log(`  -> MISMATCH: file has ${existingMatch[1]}, live CDN file hashes to ${integrity}`);
        mismatches++;
      }
      continue;
    }

    let newTag = fullTag;
    if (existingMatch) {
      newTag = newTag.replace(/integrity="[^"]*"/, `integrity="${integrity}"`);
    } else {
      newTag = newTag.replace(/^<(script|link)\b/, `<$1 integrity="${integrity}" crossorigin="anonymous"`);
    }
    if (!/crossorigin=/.test(newTag)) {
      newTag = newTag.replace(/^<(script|link)\b/, `<$1 crossorigin="anonymous"`);
    }
    results.push([fullTag, newTag]);
  }

  if (CHECK_ONLY) {
    if (mismatches > 0) {
      console.error(`\n${mismatches} tag(s) need attention. Run without --check to fix.`);
      process.exit(1);
    }
    console.log('\nAll pinned CDN tags have matching SRI hashes.');
    return;
  }

  for (const [oldTag, newTag] of results) {
    html = html.replace(oldTag, newTag);
  }
  writeFileSync(INDEX_HTML, html);
  console.log(`\nUpdated ${results.length} tag(s) in ${INDEX_HTML}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
