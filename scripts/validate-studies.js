#!/usr/bin/env node
// Checks study files against schema/study.schema.json, then runs checks a
// schema can't express (counts that must add up, codes that must exist,
// i18n keys with no English text). The checks live in src/studyCheck/check.js,
// shared with the study builder.
//
//   npm run validate                      all files in public/experiments/
//   npm run validate -- path/to/a.json    just these files
//   npm run validate -- --notes           also list notes (old keys that do nothing)
//
// Exits 1 if any file has an error. Warnings and notes don't fail the run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChecker } from '../src/studyCheck/check.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experimentsDir = path.join(root, 'public/experiments');
const imagesDir = path.join(root, 'public/images');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema/study.schema.json'), 'utf8'));
const locales = {};
for (const lang of ['en', 'fa', 'ar']) {
  locales[lang] = JSON.parse(fs.readFileSync(path.join(root, `public/locales/${lang}.json`), 'utf8'));
}
const check = makeChecker({ schema, locales, imageExists: (f) => fs.existsSync(path.join(imagesDir, f)) });

function checkFile(file) {
  let study;
  try {
    study = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { errors: [{ text: `not valid JSON: ${e.message}` }], warnings: [], notes: [] };
  }
  return check(study, path.basename(file, '.json'));
}

const args = process.argv.slice(2);
const showNotes = args.includes('--notes');
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  files = fs.readdirSync(experimentsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(experimentsDir, f));
}

let errorCount = 0, warnCount = 0, noteCount = 0, failed = 0;
for (const file of files) {
  const { errors, warnings, notes } = checkFile(file);
  errorCount += errors.length; warnCount += warnings.length; noteCount += notes.length;
  if (errors.length) failed++;
  const shown = [...errors.map((s) => `  error  ${s.text}`), ...warnings.map((s) => `  warn   ${s.text}`), ...(showNotes ? notes.map((s) => `  note   ${s.text}`) : [])];
  if (shown.length) console.log(`\n${path.relative(root, path.resolve(file))}\n${shown.join('\n')}`);
}
console.log(`\n${files.length} file(s): ${errorCount} error(s) in ${failed} file(s), ${warnCount} warning(s), ${noteCount} note(s)${showNotes || !noteCount ? '' : ' (--notes to list)'}`);
process.exit(errorCount ? 1 : 0);
