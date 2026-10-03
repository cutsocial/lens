#!/usr/bin/env node
// Checks study files against schema/study.schema.json, then runs checks a
// schema can't express (counts that must add up, codes that must exist,
// i18n keys missing from the English locale).
//
//   npm run validate                      all files in public/experiments/
//   npm run validate -- path/to/a.json    just these files
//   npm run validate -- --notes           also list notes (old keys that do nothing)
//
// Exits 1 if any file has an error. Warnings and notes don't fail the run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { normalizeConfig } from '../src/multiplayer/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experimentsDir = path.join(root, 'public/experiments');
const imagesDir = path.join(root, 'public/images');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema/study.schema.json'), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const locales = {};
for (const lang of ['en', 'fa', 'ar']) {
  locales[lang] = JSON.parse(fs.readFileSync(path.join(root, `public/locales/${lang}.json`), 'utf8'));
}

const GONOGOALT_ICONS = ['star', 'circle', 'triangle', 'rectangle', 'hand', 'ball', 'watch', 'school', 'cup'];

// A string is treated as an i18n key (rather than literal text) when it has a
// dot and no spaces, like "control.q1". Literal text falls through as written.
const looksLikeKey = (s) => typeof s === 'string' && /^[\w-]+(\.[\w-]+)+$/.test(s);

function i18nStrings(study) {
  const out = [];
  const add = (where, s) => { if (looksLikeKey(s)) out.push([where, s]); };
  for (const k of ['submissionNote', 'redirectText', 'redirectLabel']) add(k, study[k]);
  (study.views || []).forEach((v, i) => {
    const at = (f) => `views[${i}] (${v.id ?? v.type}).${f}`;
    for (const k of ['text', 'placeholder', 'rule', 'startText', 'dialogOptionalText']) add(at(k), v[k]);
    if (/^matrix2?$/.test(v.type)) {
      (v.questions || []).forEach((q, j) => add(at(`questions[${j}]`), q));
      (v.choices || []).forEach((c, j) => add(at(`choices[${j}]`), c));
    }
    if (v.words && typeof v.words === 'object') for (const [c, w] of Object.entries(v.words)) add(at(`words.${c}`), w);
    if (Array.isArray(v.persons) && v.personsPrefix) {
      for (const p of v.persons) for (const [f, val] of Object.entries(p)) {
        if (/^field\d+$/.test(f) && typeof val === 'string' && val) out.push([at(`persons[id=${p.id}].${f}`), `${v.personsPrefix}${p.id}.${val}`]);
      }
    }
  });
  return out;
}

function semanticChecks(study, file, report) {
  const { error, warn, note } = report;
  const base = path.basename(file, '.json');
  if (study.studyId !== undefined && study.studyId !== base) {
    note(`studyId "${study.studyId}" differs from the file name "${base}" (the URL uses the file name; studyId isn't read)`);
  }
  if ('conditon' in study) note('"conditon" is a misspelling of "condition" (neither is read by the app)');

  const seen = new Map();
  (study.views || []).forEach((v, i) => {
    if (!v || typeof v !== 'object') return;
    const where = `views[${i}] (${v.id ?? v.type})`;
    if (v.id !== undefined) {
      if (seen.has(v.id)) warn(`${where}: id "${v.id}" is also used by views[${seen.get(v.id)}]; the data can only tell them apart by position`);
      else seen.set(v.id, i);
    }
    if ('help' in v) note(`${where}: "help" has no effect (never implemented)`);
    if ('pattern' in v) note(`${where}: "pattern" has no effect (never implemented)`);

    const t = v.trials;
    switch (v.type) {
      case 'matrix': case 'matrix2': {
        const n = (v.questions || []).length;
        for (const q of v.requiredQuestions || []) {
          if (q >= n) error(`${where}: requiredQuestions has ${q}, but there are only ${n} questions (indexes start at 0)`);
        }
        break;
      }
      case 'gonogo':
        if (t && typeof t === 'object') {
          if (t.go > t.total) warn(`${where}: trials.go (${t.go}) is more than trials.total (${t.total})`);
          if (t.left > t.total) warn(`${where}: trials.left (${t.left}) is more than trials.total (${t.total})`);
          if (t.leftGo > Math.min(t.go, t.left)) warn(`${where}: trials.leftGo (${t.leftGo}) must be at most go (${t.go}) and left (${t.left})`);
          if (t.go + t.left - t.leftGo > t.total) warn(`${where}: go + left − leftGo (${t.go + t.left - t.leftGo}) is more than trials.total (${t.total}); the left/right split can't be met`);
        }
        break;
      case 'gonogoalt': case 'gonogoalt2':
        if (t && t.go > t.total) warn(`${where}: trials.go (${t.go}) is more than trials.total (${t.total})`);
        for (const side of ['go', 'nogo']) {
          const set = v.choices?.[side];
          if (set?.type === 'icon') for (const n of set.names || []) {
            if (!GONOGOALT_ICONS.includes(n)) error(`${where}: choices.${side} icon "${n}" is not one of ${GONOGOALT_ICONS.join(', ')}`);
          }
        }
        break;
      case 'taskswitch':
        if (t?.top && t?.bottom) {
          for (const h of ['top', 'bottom']) {
            const s = t[h];
            if (s.go > s.total || s.left > s.total || s.leftGo > Math.min(s.go, s.left) || s.go + s.left - s.leftGo > s.total) {
              warn(`${where}: trials.${h} counts don't fit in its total (${s.total})`);
            }
          }
          if (t.top.total + t.bottom.total !== t.total) warn(`${where}: trials.top.total + trials.bottom.total (${t.top.total + t.bottom.total}) ≠ trials.total (${t.total})`);
        }
        break;
      case 'simplified_taskswitch':
        if (t && typeof t === 'object') {
          for (const k of ['typeA', 'left', 'figureA', 'colorA']) {
            if (t[k] > t.total) warn(`${where}: trials.${k} (${t[k]}) is more than trials.total (${t.total})`);
          }
        }
        break;
      case 'stroop': case 'stroop2': {
        // A code is two letters: word, then ink. The right answer is the choice
        // whose word names the stimulus's ink. A choice's ink may be left out of
        // colors on purpose (e.g. "W"): the button is then drawn in the default color.
        const colors = Object.keys(v.colors || {});
        const words = Object.keys(v.words || {});
        const problems = new Set();
        let unanswerable = 0;
        for (const tr of Array.isArray(t) ? t : []) {
          const [sw, sc] = tr.stimulus || '';
          if (sw && !words.includes(sw)) problems.add(`stimulus word "${sw}" has no entry in words`);
          if (sc && !colors.includes(sc)) problems.add(`stimulus ink "${sc}" has no entry in colors`);
          for (const c of tr.choices || []) if (c[0] && !words.includes(c[0])) problems.add(`choice word "${c[0]}" has no entry in words`);
          if (tr.choices && !tr.choices.some((c) => c[0] === sc)) unanswerable++;
        }
        for (const m of problems) error(`${where}: ${m}`);
        if (unanswerable) warn(`${where}: ${unanswerable} trial(s) have no choice whose word matches the stimulus ink, so no answer is correct`);
        break;
      }
      case 'nback': case 'nback2': {
        if (v.nback >= v.trials) error(`${where}: nback (${v.nback}) must be smaller than trials (${v.trials})`);
        const sum = (v.stimuli || []).reduce((a, s) => a + (s.amount || 0), 0);
        if (sum < v.trials) note(`${where}: stimuli amounts add up to ${sum}, fewer than trials (${v.trials}); the stream wraps around to fill it`);
        break;
      }
      case 'dictator': case 'dictator2': case 'ultimatum': case 'ultimatum2': {
        const persons = v.persons || [];
        if (persons.length && !v.personsPrefix) warn(`${where}: persons are listed but personsPrefix is missing, so their text won't resolve`);
        const ids = new Set();
        for (const p of persons) {
          if (ids.has(p.id)) error(`${where}: two persons have id ${p.id}`);
          ids.add(p.id);
          if (p.avatar && !fs.existsSync(path.join(imagesDir, p.avatar))) warn(`${where}: avatar "${p.avatar}" is not in public/images/`);
          if ('minAcceptable' in p && /^dictator/.test(v.type)) note(`${where}: minAcceptable has no effect in dictator`);
          if (p.minAcceptable > v.tokens) warn(`${where}: person ${p.id} has minAcceptable ${p.minAcceptable} > tokens ${v.tokens}, so rejects every offer`);
        }
        if (v.useOpponentTypes) {
          const types = v.opponentTypes || [];
          if (!types.length) error(`${where}: useOpponentTypes is true but opponentTypes is empty`);
          for (const tag of types) {
            if (!persons.some((p) => (p.tags || []).includes(tag))) error(`${where}: no person has the opponent type "${tag}"`);
          }
        }
        break;
      }
      case 'multiplayer':
        // the same check the game and the server run, e.g. a "simple" bot that would have to propose
        try { normalizeConfig(v); } catch (e) { error(`${where}: ${e.message}`); }
        break;
      default:
    }
  });

  // Grouped by view so one untranslated scale is one line, not thirty.
  const missingByView = new Map();
  for (const [where, key] of i18nStrings(study)) {
    if (key in locales.en) continue;
    const view = where.split('.')[0].replace(/\[\d+\]$/, '');
    if (!missingByView.has(view)) missingByView.set(view, []);
    missingByView.get(view).push(key);
  }
  for (const [view, keys] of missingByView) {
    const shown = keys.slice(0, 3).map((k) => `"${k}"`).join(', ') + (keys.length > 3 ? `, … (${keys.length} in all)` : '');
    warn(`${view}: ${shown} not in locales/en.json, so participants see the key itself`);
  }
  for (const lang of ['fa', 'ar']) {
    const n = i18nStrings(study).filter(([, key]) => key in locales.en && !(key in locales[lang])).length;
    if (n) note(`${n} key(s) have English text but none in ${lang}.json (fine if the study isn't run in ${lang})`);
  }
}

function formatAjvError(e, study) {
  let where = e.instancePath || '(top level)';
  const m = where.match(/^\/views\/(\d+)/);
  if (m) {
    const v = study.views?.[m[1]];
    where = where.replace(/^\/views\/(\d+)/, `views[${m[1]}]${v?.id ? ` (${v.id})` : ''}`);
  }
  where = where.replace(/^\//, '').replace(/\/(\d+)/g, '[$1]').replace(/\//g, '.');
  switch (e.keyword) {
    case 'additionalProperties': return `${where}: unknown key "${e.params.additionalProperty}"`;
    case 'unevaluatedProperties': return `${where}: unknown key "${e.params.unevaluatedProperty}"`;
    case 'discriminator': return `${where}: unknown view type "${e.params.tagValue ?? '(missing)'}"`;
    case 'enum': return `${where}: must be one of ${e.params.allowedValues.map((x) => JSON.stringify(x)).join(', ')}`;
    default: return `${where}: ${e.message}`;
  }
}

function checkFile(file) {
  const out = { errors: [], warnings: [], notes: [] };
  const report = { error: (s) => out.errors.push(s), warn: (s) => out.warnings.push(s), note: (s) => out.notes.push(s) };
  let study;
  try {
    study = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    report.error(`not valid JSON: ${e.message}`);
    return out;
  }
  if (!validate(study)) {
    // Drop the generic "must match exactly one schema in oneOf" lines; the specific ones say more.
    const msgs = [...new Set(validate.errors.filter((e) => e.keyword !== 'oneOf').map((e) => formatAjvError(e, study)))];
    msgs.forEach(report.error);
  }
  semanticChecks(study, file, report);
  return out;
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
  const shown = [...errors.map((s) => `  error  ${s}`), ...warnings.map((s) => `  warn   ${s}`), ...(showNotes ? notes.map((s) => `  note   ${s}`) : [])];
  if (shown.length) console.log(`\n${path.relative(root, path.resolve(file))}\n${shown.join('\n')}`);
}
console.log(`\n${files.length} file(s): ${errorCount} error(s) in ${failed} file(s), ${warnCount} warning(s), ${noteCount} note(s)${showNotes || !noteCount ? '' : ' (--notes to list)'}`);
process.exit(errorCount ? 1 : 0);
