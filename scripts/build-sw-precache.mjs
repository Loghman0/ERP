#!/usr/bin/env node
/**
 * scripts/build-sw-precache.mjs
 * ---------------------------------------------------------------------
 * Generates sw-precache-manifest.json — the list of local (same-origin)
 * files the service worker caches for offline app-shell loading, plus a
 * content hash used as the cache-version key.
 *
 * WHY GENERATED RATHER THAN HAND-MAINTAINED:
 * A hand-written file list in the service worker is exactly the kind of
 * thing that silently goes stale — someone adds views/newfeature.js,
 * wires it into index.html, ships it, and it's invisible offline
 * because nobody remembered to also add it to a separate cache list.
 * This script reads the SAME <script src="...">/<link rel="stylesheet">
 * tags index.html already uses to load the app, so the precache list
 * can never drift out of sync with what the app actually loads —
 * running this script IS the source of truth, not a copy of it.
 *
 * It also hashes the combined contents of every precached file into a
 * short version string. The service worker uses that version as its
 * cache name (CACHE_NAME = `meram-shell-v${version}`), so any code
 * change automatically busts old caches on next visit — no manual
 * "bump the cache version number" step to forget, which is the other
 * classic way service-worker caching bugs ship (see audit Section 4:
 * "no cache-busting / versioning strategy" was flagged before this
 * file existed).
 *
 * Usage: node scripts/build-sw-precache.mjs
 * Run this after any change to index.html's local <script>/<link> tags,
 * or any change to a precached file's content — ideally as a predeploy
 * step (ties in with firebase.json's hosting config).
 * ---------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const OUT_PATH = path.join(ROOT, 'sw-precache-manifest.json');

// Only local, relative paths — explicitly NOT the CDN scripts (Firebase,
// Tailwind, Chart.js, etc). Those are third-party and versioned/pinned
// separately (see scripts/add-sri-hashes.mjs); precaching them here
// would mean the service worker silently serving a stale copy of a
// security-relevant library forever, which is worse than not caching
// them at all — better to let the browser's normal HTTP cache handle
// those with their own real cache headers from the CDN.
const LOCAL_SRC_RE = /<(?:script|link)\b[^>]*\b(?:src|href)="((?!https?:\/\/)[^"]+)"[^>]*>/g;

function extractLocalAssets(html) {
  const paths = new Set();
  let m;
  while ((m = LOCAL_SRC_RE.exec(html))) {
    const p = m[1];
    // Skip the manifest link itself and any in-page anchors/query-only refs.
    if (!p || p.startsWith('#') || p === 'manifest.json') continue;
    paths.add(p);
  }
  return [...paths];
}

function main() {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const assets = extractLocalAssets(html);

  // Always include the shell itself + the manifest + the icons the
  // manifest references — these aren't <script>/<link> tags so the
  // regex above can't find them, but they're just as essential to an
  // offline-loadable app shell.
  const alwaysInclude = [
    './',
    'index.html',
    'manifest.json',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'assets/favicon-32.png',
    'assets/favicon-16.png',
  ];

  const allPaths = [...new Set([...alwaysInclude, ...assets])];

  const hash = createHash('sha256');
  const missing = [];
  for (const rel of allPaths.sort()) {
    const abs = path.join(ROOT, rel === './' ? 'index.html' : rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    hash.update(rel);
    hash.update(readFileSync(abs));
  }

  if (missing.length) {
    console.warn(`Warning: ${missing.length} referenced local asset(s) not found on disk, skipped:`, missing);
  }

  const version = hash.digest('hex').slice(0, 12);
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    files: allPaths.filter((p) => !missing.includes(p)),
  };

  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH} — version ${version}, ${manifest.files.length} files.`);
}

main();
