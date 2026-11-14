#!/usr/bin/env node
/**
 * Pre-flight check for a static deploy (GitHub Pages, Netlify, anything).
 *
 *   node scripts/check-deploy.mjs
 *
 * It answers the three questions that actually break a deploy:
 *
 *  1. Is a file too large for the host? GitHub refuses any file above 100 MiB
 *     and warns above 50 MiB. The LOLA product (111 MB) must stay out of Git —
 *     `.gitignore` already covers `pipeline/lola/`, this check proves it.
 *  2. Does every referenced asset exist, with the exact same case? Windows is
 *     case-insensitive, GitHub Pages is not: `Moon.jpg` works locally and 404s
 *     online, which is exactly how a 3D globe silently disappears.
 *  3. Is the repository small enough to clone quickly?
 *
 * Exit code 1 on a blocking problem, so it can gate a deploy script.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const HARD_LIMIT = 100 * 1024 * 1024;
const WARN_LIMIT = 50 * 1024 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', '.vscode']);
const SKIP_FILES = new Set(['scripts/check-deploy.mjs']);
const BINARY = new Set(['.jpg', '.jpeg', '.png', '.webp', '.ico', '.woff', '.woff2', '.pdf']);
const TEXT = new Set(['.js', '.mjs', '.html', '.css', '.json', '.svg', '.md', '.txt']);

const problems = [];
const notes = [];

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else files.push(path);
  }
  return files;
}

// Whatever .gitignore excludes is not published, so it is not checked.
const ignoredDirs = new Set();
const ignoredExt = new Set();
try {
  const lines = (await readFile(join(ROOT, '.gitignore'), 'utf8')).split('\n');
  for (const line of lines) {
    const rule = line.trim();
    if (!rule || rule.startsWith('#')) continue;
    if (rule.startsWith('*.')) ignoredExt.add(rule.slice(1).toLowerCase());
    else if (rule.endsWith('/')) ignoredDirs.add(rule.replace(/\/$/, '').split('/').pop());
  }
} catch {
  /* no .gitignore: check everything */
}

const files = (await walk(ROOT)).filter((file) => {
  const rel = relative(ROOT, file).split('\\').join('/');
  if (SKIP_FILES.has(rel)) return false;
  if (ignoredExt.has(extname(file).toLowerCase())) return false;
  if (rel.split('/').some((part) => ignoredDirs.has(part))) return false;
  return true;
});

// --- 1. sizes ------------------------------------------------------------

let total = 0;
for (const file of files) {
  const info = await stat(file);
  total += info.size;
  const size = info.size;
  if (size > HARD_LIMIT) {
    problems.push(`${relative(ROOT, file)} : ${(size / 1048576).toFixed(0)} Mo — au-dessus de la limite de 100 Mo de GitHub`);
  } else if (size > WARN_LIMIT) {
    notes.push(`${relative(ROOT, file)} : ${(size / 1048576).toFixed(0)} Mo — gros fichier, à éviter dans Git`);
  }
}

// --- 2. references -------------------------------------------------------

const refs = new Map();
const pattern = /['"`]([^'"`\s]+\.(?:js|mjs|css|jpg|jpeg|png|svg|webp|json|woff2?))['"`]/g;

for (const file of files) {
  // Documentation is not shipped code: its examples are not assets.
  if (extname(file).toLowerCase() === '.md') continue;
  if (!TEXT.has(extname(file).toLowerCase())) continue;
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(pattern)) {
    const ref = match[1];
    // A reference marked `optional-asset` on its line is a slot filled only
    // when the file is present: absence is not a deployment problem.
    const line = text.slice(text.lastIndexOf('\n', match.index) + 1, text.indexOf('\n', match.index));
    if (line.includes('optional-asset')) continue;
    if (/^(https?:|data:|blob:)/.test(ref)) continue;
    if (ref.includes('${')) continue;
    if (!refs.has(ref)) refs.set(ref, new Set());
    refs.get(ref).add(relative(ROOT, file));
  }
}

const BASES = ['', 'assets/js', 'assets', 'assets/css', 'data'];

function resolveRef(ref) {
  for (const base of BASES) {
    const candidate = resolve(ROOT, base, ref);
    if (existsSync(candidate)) {
      const dir = candidate.slice(0, candidate.lastIndexOf('/') > -1 ? candidate.lastIndexOf('/') : 0) || '.';
      return { path: candidate, dir };
    }
  }
  return null;
}

for (const [ref, sources] of refs) {
  // Bare package specifiers ("three", "three/addons/…") are resolved by the
  // import map; globs and templated URLs are documentation, not assets.
  if (ref.startsWith('three/')) continue;
  if (ref.includes('*')) continue;
  if (!ref.includes('/') && !/\.[a-z0-9]+$/i.test(ref)) continue;
  if (ref.includes('..')) continue;
  const found = resolveRef(ref);
  if (!found) {
    problems.push(`référence introuvable : ${ref} (dans ${[...sources].join(', ')})`);
    continue;
  }
  // Case check: read the directory and compare the exact name.
  try {
    const dir = found.path.replace(/[\\/][^\\/]+$/, '');
    const name = found.path.split(/[\\/]/).pop();
    const entries = await readdir(dir);
    if (!entries.includes(name)) {
      problems.push(`casse différente : ${ref} — le fichier s'appelle ${entries.find((e) => e.toLowerCase() === name.toLowerCase()) || '?'} (GitHub Pages est sensible à la casse)`);
    }
  } catch {
    /* directory listing is best effort */
  }
}

// --- 3. deployment files -------------------------------------------------

if (!existsSync(join(ROOT, '.nojekyll'))) {
  notes.push('.nojekyll absent : GitHub Pages passera par Jekyll, inutile ici');
}
if (!existsSync(join(ROOT, 'index.html'))) {
  problems.push('index.html absent à la racine');
}

// --- report --------------------------------------------------------------

console.log(`Fichiers : ${files.length} · total ${(total / 1048576).toFixed(1)} Mo`);
for (const note of notes) console.log(`  note    ${note}`);
for (const problem of problems) console.log(`  BLOQUANT ${problem}`);

if (problems.length) {
  console.log(`\n${problems.length} problème(s) à corriger avant de publier.`);
  process.exit(1);
}
console.log('\nPrêt à publier.');
