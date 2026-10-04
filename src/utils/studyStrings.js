/**
 * A study file may carry its own text: "strings": {"en": {"key": "text"}, ...}.
 * Adds it to i18next on top of the shared locale files (call after they've
 * loaded, so the study's text wins for keys both define).
 */
export function addStudyStrings(i18n, study) {
  const strings = study && study.strings;
  if (!strings || typeof strings !== 'object') return;
  for (const [lang, table] of Object.entries(strings)) {
    if (table && typeof table === 'object') i18n.addResourceBundle(lang, 'translation', table, true, true);
  }
}
