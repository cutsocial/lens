/**
 * Study builder: the study being edited, and how its text is stored.
 *
 * The builder edits the study file itself (the same JSON Lens runs). Text
 * fields hold either plain text or an i18n key. The builder shows text in the
 * language being edited and stores what's typed in the study's own
 * "strings": {lang: {key: text}}, so a study carries its wording and
 * translations in one file:
 *   - a field that already holds a key keeps it; the text for this language
 *     goes into strings under that key (overriding the shared locale files);
 *   - a field holding plain text gets a new key, named after the page and
 *     field, and its existing text is kept for the language it was in.
 */
import { i18nStrings, looksLikeKey } from '../studyCheck/check';

export const LANGS = { en: { label: 'English', dir: 'ltr' }, fa: { label: 'فارسی', dir: 'rtl' }, ar: { label: 'العربية', dir: 'rtl' } };

// ----- paths: ['views', 2, 'questions', 0] -----
export function getIn(obj, path) {
  return path.reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}
export function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  const next = setIn(base[k], rest, value);
  if (next === undefined && !Array.isArray(base)) delete base[k];
  else base[k] = next;
  return base;
}

// ----- text -----
/** The text a field shows in `lang`: study strings, then the shared locale files, then the value itself. */
export function textOf(study, value, lang, locales) {
  if (typeof value !== 'string' || value === '') return '';
  const own = study.strings && study.strings[lang];
  if (own && Object.prototype.hasOwnProperty.call(own, value)) return own[value];
  const shared = locales[lang];
  if (shared && Object.prototype.hasOwnProperty.call(shared, value)) return shared[value];
  if (!looksLikeKey(value)) {
    // plain text: it's the study's main language
    return lang === mainLang(study) ? value : '';
  }
  return '';
}

/** The language a study's plain text is in: English unless it only has strings in another language. */
export function mainLang(study) {
  const langs = Object.keys(study.strings || {});
  return langs.length && !langs.includes('en') ? langs[0] : 'en';
}

const isKeyIn = (study, value) => typeof value === 'string' && Object.values(study.strings || {}).some((t) => t && Object.prototype.hasOwnProperty.call(t, value));

/** A key not used yet, e.g. "welcome.text" or "welcome.text-2". */
function freshKey(study, hint) {
  const base = hint.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'text';
  let key = base;
  let n = 2;
  while (isKeyIn(study, key)) key = `${base}-${n++}`;
  return key;
}

/**
 * Sets the text of the field at `path` in `lang`. Returns the new study.
 * `keyHint` names a new key if the field needs one.
 */
export function setText(study, path, lang, text, keyHint, locales) {
  let value = getIn(study, path);
  let next = study;
  if (!(typeof value === 'string' && value && (isKeyIn(study, value) || looksLikeKey(value)))) {
    // plain text (or empty): give the field its own key, keeping what it said
    const key = freshKey(study, keyHint);
    const strings = { ...(study.strings || {}) };
    if (typeof value === 'string' && value) {
      const ml = mainLang(study);
      strings[ml] = { ...(strings[ml] || {}), [key]: value };
    }
    next = setIn({ ...study, strings }, path, key);
    value = key;
  }
  const strings = { ...(next.strings || {}) };
  strings[lang] = { ...(strings[lang] || {}), [value]: text };
  return { ...next, strings };
}

/**
 * Persons in the token games: their text keys are `${personsPrefix}${id}.${fieldN}`.
 * Returns [key, study] for a person's field, giving the page a prefix and the
 * field a value if they don't have one yet.
 */
export function personKey(study, viewIndex, personIndex, field) {
  let next = study;
  const view = next.views[viewIndex];
  let prefix = view.personsPrefix;
  if (!prefix) {
    prefix = `${view.id || 'game'}.p`;
    next = setIn(next, ['views', viewIndex, 'personsPrefix'], prefix);
  }
  const person = next.views[viewIndex].persons[personIndex];
  let val = person[field];
  if (!val) {
    val = field;
    next = setIn(next, ['views', viewIndex, 'persons', personIndex, field], val);
  }
  return [`${prefix}${person.id}.${val}`, next];
}

export function setKeyText(study, key, lang, text) {
  const strings = { ...(study.strings || {}) };
  strings[lang] = { ...(strings[lang] || {}), [key]: text };
  return { ...study, strings };
}

/** Removes study strings no field uses any more (before downloading). */
export function pruneStrings(study) {
  if (!study.strings) return study;
  const used = new Set(i18nStrings(study).map(([, key]) => key));
  const strings = {};
  for (const [lang, table] of Object.entries(study.strings)) {
    const kept = Object.fromEntries(Object.entries(table || {}).filter(([k]) => used.has(k)));
    if (Object.keys(kept).length) strings[lang] = kept;
  }
  const out = { ...study, strings };
  if (!Object.keys(strings).length) delete out.strings;
  return out;
}

/** Text fields of a page resolved to plain text in `lang` (for page templates taken from demo studies). */
export function plainCopy(view, locales, lang = 'en') {
  const v = JSON.parse(JSON.stringify(view));
  const fake = { views: [v] };
  const resolve = (s) => (typeof s === 'string' && locales[lang] && locales[lang][s] !== undefined ? locales[lang][s] : s);
  for (const k of ['text', 'placeholder', 'rule', 'startText', 'dialogOptionalText']) if (k in v) v[k] = resolve(v[k]);
  for (const k of ['questions', 'choices']) if (Array.isArray(v[k]) && /^matrix/.test(v.type)) v[k] = v[k].map(resolve);
  if (v.words) for (const c of Object.keys(v.words)) v.words[c] = resolve(v.words[c]);
  void fake;
  return v;
}

/** A page id not used yet in the study. */
export function freshId(study, base) {
  const ids = new Set((study.views || []).map((v) => v.id));
  let n = 1;
  let id = base;
  while (ids.has(id)) id = `${base}-${++n}`;
  return id;
}

/** Short summary of a page for the page list. */
export function pageSummary(study, view, lang, locales) {
  const t = (k) => textOf(study, view[k], lang, locales);
  const first = t('text') || t('rule') || (Array.isArray(view.questions) ? textOf(study, view.questions[0], lang, locales) : '');
  return first.replace(/[*_#>`]/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
}
