/**
 * The study file as JSON, editable in place of the form (Form | JSON switch).
 *
 * - Every valid edit is applied to the study at once, so the page list, the
 *   checks and the preview follow what's typed. While the text isn't valid
 *   JSON, the study keeps its last valid version and the error is marked.
 * - Picking a page in the page list scrolls to that page here and highlights
 *   it; moving the cursor into a page selects it in the list and the preview.
 * - The checks' problems are marked on the lines they're about.
 *
 * Loaded on first use (CodeMirror is a separate chunk).
 */
import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { Annotation, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import {
  parse as tolerantParse, parseTree, findNodeAtLocation, findNodeAtOffset, getNodePath, printParseErrorCode,
} from 'jsonc-parser';

/** The text the builder shows and downloads for a study. */
export const studyText = (study) => JSON.stringify(study, null, 2);

const external = Annotation.define(); // changes made by the builder, not typed

// ----- the selected page's lines -----
const setPage = StateEffect.define();
const pageField = StateField.define({
  create: () => null,
  update: (v, tr) => tr.effects.reduce((acc, e) => (e.is(setPage) ? e.value : acc), v),
});

function nodeFor(tree, page) {
  if (!tree) return null;
  if (page === 'settings') return null;
  return findNodeAtLocation(tree, ['views', page]) || null;
}

const pageLines = EditorView.decorations.compute(['doc', pageField], (state) => {
  const page = state.field(pageField);
  const builder = new RangeSetBuilder();
  if (page === null || page === 'settings') return builder.finish();
  const node = nodeFor(parseTree(state.doc.toString()), page);
  if (!node) return builder.finish();
  const first = state.doc.lineAt(node.offset).number;
  const last = state.doc.lineAt(Math.min(node.offset + node.length, state.doc.length)).number;
  for (let n = first; n <= last; n++) {
    const cls = n === first ? 'lb-json-page lb-json-page-first' : n === last ? 'lb-json-page lb-json-page-last' : 'lb-json-page';
    builder.add(state.doc.line(n).from, state.doc.line(n).from, Decoration.line({ class: cls }));
  }
  return builder.finish();
});

// ----- reading the text -----
const camelWords = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

/** {study} if the text is a usable study, else {error: {from, message}}. */
export function readStudy(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    const errs = [];
    tolerantParse(text, errs, { allowTrailingComma: false, disallowComments: true });
    const first = errs[0];
    let at = first ? first.offset : 0;
    if (first && printParseErrorCode(first.error) === 'CommaExpected') {
      // the comma is missing after the previous value: point there, not at the next line
      while (at > 0 && /\s/.test(text[at - 1])) at--;
      at = Math.max(at - 1, 0);
    }
    return {
      error: first
        ? { from: at, to: at + Math.max(first.length, 1), message: `Not valid JSON: ${camelWords(printParseErrorCode(first.error))}` }
        : { from: 0, to: 0, message: `Not valid JSON: ${e.message}` },
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: { from: 0, to: 1, message: 'A study file is one object: { … }' } };
  if (!Array.isArray(value.views)) return { error: { from: 0, to: 1, message: 'A study needs a "views" list (its pages)' } };
  return { study: value };
}

// ----- problems from the checks, placed on their lines -----
function diagnosticsFor(state, issues) {
  const tree = parseTree(state.doc.toString());
  if (!tree) return [];
  const out = [];
  for (const it of issues) {
    let path = it.path ? it.path.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)) : (it.view !== null && it.view !== undefined ? ['views', it.view] : []);
    let node = null;
    while (!node && path.length) {
      node = findNodeAtLocation(tree, path);
      if (!node) path = path.slice(0, -1);
    }
    node = node || tree;
    // mark the property name and its value, on the first line only
    const start = node.parent && node.parent.type === 'property' ? node.parent.offset : node.offset;
    const end = Math.min(node.offset + node.length, state.doc.lineAt(start).to);
    out.push({
      from: start,
      to: Math.max(end, start + 1),
      severity: it.level === 'error' ? 'error' : 'warning',
      message: it.text.replace(/^views\[\d+\] \([^)]*\)[.:]?\s*/, ''),
    });
  }
  return out;
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: '#fff' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: '#fafbfc', borderInlineEnd: '1px solid #e3e6eb', color: '#9aa1ab' },
  '.cm-activeLineGutter, .cm-activeLine': { backgroundColor: 'rgba(37, 99, 235, 0.05)' },
  '.lb-json-page': { backgroundColor: '#eef3ff' },
  '.lb-json-page.cm-activeLine': { backgroundColor: '#e2ebff' },
  '.lb-json-page-first': { boxShadow: 'inset 0 1px 0 #c7d7fe' },
  '.lb-json-page-last': { boxShadow: 'inset 0 -1px 0 #c7d7fe' },
});

/**
 * @param study     the study (last valid version)
 * @param onChange  called with the study after each valid edit
 * @param onValid   called with (true) or (false, what's wrong) as the text becomes valid or not
 * @param selected  page index or 'settings'
 * @param jump      changes when a page is picked in the page list (scroll to it)
 * @param onCursorPage  called with the page the cursor moved into
 * @param issues    the checks' problems [{level, text, view, path}]
 */
export default function JsonEditor({ study, onChange, onValid, selected, jump, onCursorPage, issues }) {
  const host = useRef(null);
  const viewRef = useRef(null);
  const parseError = useRef(null);
  const latest = useRef({});
  latest.current = { onChange, onValid, onCursorPage, selected, issues };

  const pushDiagnostics = (view) => {
    const err = parseError.current;
    const diags = err
      ? [{ from: Math.min(err.from, view.state.doc.length), to: Math.min(err.to, view.state.doc.length), severity: 'error', message: err.message }]
      : diagnosticsFor(view.state, latest.current.issues || []);
    view.dispatch(setDiagnostics(view.state, diags));
  };

  // create the editor once
  useEffect(() => {
    const view = new EditorView({
      parent: host.current,
      doc: studyText(study),
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        json(),
        lintGutter(),
        pageField,
        pageLines,
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Study file (JSON)' }),
        EditorView.updateListener.of((u) => {
          const mine = u.transactions.some((tr) => tr.annotation(external));
          if (u.docChanged && !mine) {
            const r = readStudy(u.state.doc.toString());
            const wasBroken = !!parseError.current;
            parseError.current = r.error || null;
            if (r.study) latest.current.onChange(r.study);
            if (r.error) {
              const line = u.state.doc.lineAt(Math.min(r.error.from, u.state.doc.length)).number;
              latest.current.onValid(false, `${r.error.message} (line ${line})`);
            } else if (wasBroken) latest.current.onValid(true);
            if (r.error || wasBroken) setTimeout(() => pushDiagnostics(u.view), 0);
          }
          if (u.selectionSet && !mine) {
            const tree = parseTree(u.state.doc.toString());
            const node = tree && findNodeAtOffset(tree, u.state.selection.main.head, true);
            const path = node ? getNodePath(node) : [];
            const page = path[0] === 'views' && typeof path[1] === 'number' ? path[1] : path[0] !== 'views' ? 'settings' : null;
            if (page !== null && page !== latest.current.selected) latest.current.onCursorPage(page);
          }
        }),
      ],
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the study changed outside the editor (page list, Open, New): show it,
  // replacing only the part that differs so the scroll position stays
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString();
    const r = readStudy(text);
    if (r.study && JSON.stringify(r.study) === JSON.stringify(study)) return;
    const next = studyText(study);
    let a = 0;
    while (a < text.length && a < next.length && text[a] === next[a]) a++;
    let b = 0;
    while (b < text.length - a && b < next.length - a && text[text.length - 1 - b] === next[next.length - 1 - b]) b++;
    view.dispatch({ changes: { from: a, to: text.length - b, insert: next.slice(a, next.length - b) }, annotations: external.of(true) });
    if (parseError.current) { parseError.current = null; latest.current.onValid(true); }
  }, [study]);

  // highlight the selected page
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch({ effects: setPage.of(selected), annotations: external.of(true) });
  }, [selected]);

  // a page was picked in the list (or the JSON view just opened): go to it
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const node = nodeFor(parseTree(view.state.doc.toString()), selected);
    const pos = node ? node.offset : 0;
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 16 }),
      annotations: external.of(true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  // problems from the checks
  useEffect(() => {
    const view = viewRef.current;
    if (view) pushDiagnostics(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  return <div className="lb-json" ref={host} />;
}
