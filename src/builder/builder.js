/**
 * Study builder (/#/builder): edit a study file with forms instead of JSON.
 *
 * - Left: the study's pages (plus study settings). Add, reorder, duplicate, delete.
 * - Middle: a form for the selected page, generated from the study schema.
 *   Text is typed in the language chosen at the top and stored in the
 *   study's own "strings" (see model.js). Or, with the Form | JSON switch,
 *   the whole study file as JSON (jsonEditor.js).
 * - Right: a live preview of the selected page in a phone-sized frame,
 *   running the real study page in preview mode (nothing is saved).
 * - The same checks as `npm run validate` run as you type.
 *
 * The draft is kept in this browser. "Download" gives the study file; it goes
 * live once it is added to public/experiments/ in the repo (pull request).
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ThemeProvider, createTheme, CssBaseline, Button, IconButton, TextField, Menu, MenuItem, ListSubheader,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup, Chip, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, ContentCopy as CopyIcon, ArrowUpward as UpIcon,
  ArrowDownward as DownIcon, FileDownload as DownloadIcon, FolderOpen as OpenIcon,
  NoteAdd as NewIcon, Settings as SettingsIcon, DragIndicator as DragIcon, ErrorOutline as ErrorIcon, WarningAmber as WarnIcon,
} from '@mui/icons-material';

import { makeChecker } from '../studyCheck/check';
import { LANGS, freshId, pageSummary, plainCopy, pruneStrings, setIn } from './model';
import { ObjectFields, viewSchema, studySchema, humanize } from './schemaForm';
import './builder.css';

const JsonEditor = lazy(() => import('./jsonEditor'));

const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#2563eb' }, background: { default: '#f6f7f9' } },
  shape: { borderRadius: 8 },
  typography: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

const PUBLIC = process.env.PUBLIC_URL || '';
const DRAFT_KEY = 'lens-builder-draft-v1';
const UPLOAD_URL = 'https://github.com/cutsocial/lens/upload/master/public/experiments';

const TYPES = [
  { group: 'Survey', items: [['text2', 'Text or question'], ['matrix2', 'Choice questions / scale'], ['prolific2', 'Prolific ID']] },
  { group: 'Tasks', items: [['stroop2', 'Stroop'], ['gonogoalt2', 'Go/No-Go'], ['nback2', 'N-back'], ['bart2', 'BART']] },
  { group: 'Games', items: [['dictator2', 'Dictator game'], ['ultimatum2', 'Ultimatum game'], ['multiplayer', 'Multiplayer game (live)']] },
  { group: 'Classic (for existing studies)', items: [['text', 'Text (classic)'], ['matrix', 'Matrix (classic)'], ['prolific', 'Prolific ID (classic)'], ['stroop', 'Stroop (classic)'], ['gonogo', '2-choice (classic)'], ['gonogoalt', 'Go/No-Go (classic)'], ['nback', 'N-back (classic)'], ['bart', 'BART (classic)'], ['taskswitch', 'Task switch (classic)'], ['simplified_taskswitch', 'Simplified task switch (classic)'], ['dictator', 'Dictator (classic)'], ['ultimatum', 'Ultimatum (classic)']] },
];
const TYPE_LABEL = Object.fromEntries(TYPES.flatMap((g) => g.items));
const ID_BASE = { text2: 'text', matrix2: 'scale', prolific2: 'prolific-id', stroop2: 'stroop', gonogoalt2: 'gonogo', nback2: 'nback', bart2: 'bart', dictator2: 'dictator', ultimatum2: 'ultimatum', multiplayer: 'game' };

function emptyStudy() {
  return {
    studyId: 'my-study',
    views: [{ id: 'welcome', type: 'text2', instruction: true, text: 'Welcome! Thank you for taking part.' }],
  };
}

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable */ }
  return null;
}
function saveDraft(d) {
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ }
}

const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });

// ----- page list -----
function PageList({ study, selected, onSelect, onAdd, onMove, onDuplicate, onDelete, issueCount, lang, locales }) {
  const [anchor, setAnchor] = useState(null);
  const views = study.views || [];
  const box = useRef(null);
  // drag and drop: the page being dragged, and where it would land (0 = before the first page)
  const [drag, setDrag] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const endDrag = () => { setDrag(null); setDropAt(null); };
  const overPage = (e, i) => {
    if (drag === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
  };
  const dropPage = (e) => {
    e.preventDefault();
    if (drag !== null && dropAt !== null) {
      const to = dropAt > drag ? dropAt - 1 : dropAt;
      if (to !== drag) onMove(drag, to);
    }
    endDrag();
  };
  // keep the selected page in sight (e.g. when the cursor in the JSON moves to another page)
  useEffect(() => {
    const on = box.current && box.current.querySelector('.lb-page-on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  return (
    <aside className="lb-pages" aria-label="Pages" ref={box}>
      <button type="button" className={`lb-page lb-page-settings ${selected === 'settings' ? 'lb-page-on' : ''}`} onClick={() => onSelect('settings')}>
        <SettingsIcon fontSize="small" /> <span className="lb-page-title">Study settings</span>
        {issueCount('settings') > 0 && <span className="lb-badge">{issueCount('settings')}</span>}
      </button>
      <div className="lb-pages-head">Pages <span className="lb-count">{views.length}</span></div>
      <ol className="lb-page-list" onDragOver={(e) => { if (drag !== null) e.preventDefault(); }} onDrop={dropPage}>
        {views.map((v, i) => (
          <li key={`${v.id}-${i}`}
            className={[drag === i ? 'lb-dragging' : '', dropAt === i && drag !== null && drag !== i && drag !== i - 1 ? 'lb-drop-before' : '',
              dropAt === i + 1 && i === views.length - 1 && drag !== null && drag !== i ? 'lb-drop-after' : ''].join(' ').trim() || undefined}
            onDragOver={(e) => overPage(e, i)}>
            <button type="button" className={`lb-page ${selected === i ? 'lb-page-on' : ''}`} onClick={() => onSelect(i)}
              draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i + 1)); }}
              onDragEnd={endDrag} title="Drag to move">
              <span className="lb-page-num">{i + 1}</span>
              <span className="lb-page-body">
                <span className="lb-page-title">{TYPE_LABEL[v.type] || v.type}</span>
                <span className="lb-page-sub">{pageSummary(study, v, lang, locales) || v.id}</span>
              </span>
              {issueCount(i) > 0 && <span className="lb-badge">{issueCount(i)}</span>}
              <DragIcon className="lb-drag-handle" fontSize="small" aria-hidden="true" />
            </button>
            {selected === i && (
              <span className="lb-page-tools">
                <span><IconButton size="small" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}><UpIcon fontSize="inherit" /></IconButton></span>
                <span><IconButton size="small" title="Move down" aria-label="Move down" disabled={i === views.length - 1} onClick={() => onMove(i, i + 1)}><DownIcon fontSize="inherit" /></IconButton></span>
                <IconButton size="small" title="Duplicate" aria-label="Duplicate" onClick={() => onDuplicate(i)}><CopyIcon fontSize="inherit" /></IconButton>
                <IconButton size="small" title="Delete" aria-label="Delete" onClick={() => onDelete(i)}><DeleteIcon fontSize="inherit" /></IconButton>
              </span>
            )}
          </li>
        ))}
      </ol>
      <Button variant="outlined" startIcon={<AddIcon />} onClick={(e) => setAnchor(e.currentTarget)} fullWidth>Add page</Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {TYPES.flatMap((g) => [
          <ListSubheader key={g.group}>{g.group}</ListSubheader>,
          ...g.items.map(([type, label]) => (
            <MenuItem key={type} onClick={() => { setAnchor(null); onAdd(type); }} dense={g.group.startsWith('Classic')}>{label}</MenuItem>
          )),
        ])}
      </Menu>
    </aside>
  );
}

// ----- issues -----
function Issues({ items }) {
  if (!items.length) return null;
  return (
    <ul className="lb-issues">
      {items.map((it, i) => (
        <li key={i} className={`lb-issue lb-issue-${it.level}`}>
          {it.level === 'error' ? <ErrorIcon fontSize="inherit" /> : <WarnIcon fontSize="inherit" />}
          <span>{it.text.replace(/^views\[\d+\] \([^)]*\)[.:]?\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
}

// ----- the page editor -----
function PageEditor({ ctx, index, onRename }) {
  const view = ctx.study.views[index];
  const node = useMemo(() => viewSchema(view.type), [view.type]);
  const ids = (ctx.study.views || []).map((v) => v.id);
  const duplicate = ids.filter((x) => x === view.id).length > 1;
  return (
    <section className="lb-editor" aria-label="Page">
      <div className="lb-editor-head">
        <div>
          <div className="lb-kicker">Page {index + 1}</div>
          <h2>{TYPE_LABEL[view.type] || view.type}</h2>
        </div>
        <TextField size="small" label="Page id" value={view.id || ''} onChange={(e) => onRename(e.target.value)}
          error={duplicate || !view.id} helperText={duplicate ? 'Another page has this id' : 'Names this page in the data'} sx={{ width: 220 }} />
      </div>
      {node && node.description && <p className="lb-help lb-type-help">{node.description}</p>}
      <Issues items={ctx.issuesFor(index)} />
      {node && node.properties
        ? <ObjectFields ctx={ctx} path={['views', index]} node={node} skip={['type', 'id', 'personsPrefix']} />
        : <p>This page type isn't in the schema.</p>}
    </section>
  );
}

// ----- the link to give participants -----
const PROLIFIC_QUERY = '?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}';

/** Whether the study is live, and whether the live file is the same as this draft. */
function usePublished(study) {
  const id = study.studyId;
  const [state, setState] = useState({ status: 'checking' });
  useEffect(() => {
    if (!id) { setState({ status: 'noid' }); return undefined; }
    let gone = false;
    const t = setTimeout(() => {
      fetch(`${PUBLIC}/experiments/${encodeURIComponent(id)}.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((live) => {
          if (gone) return;
          if (!live || !Array.isArray(live.views)) { setState({ status: 'unpublished' }); return; }
          const same = JSON.stringify({ studyId: id, ...live }) === JSON.stringify(pruneStrings(study));
          setState({ status: same ? 'live' : 'changed' });
        });
    }, 800);
    return () => { gone = true; clearTimeout(t); };
  }, [id, study]);
  return state;
}

function StudyLink({ study }) {
  const [lang, setLang] = useState('en');
  const [prolific, setProlific] = useState(true);
  const [copied, setCopied] = useState(false);
  const { status } = usePublished(study);
  const base = `${window.location.origin}${window.location.pathname}`;
  const link = `${base}#/${study.studyId || 'your-study-id'}/${lang}${prolific ? PROLIFIC_QUERY : ''}`;
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    try { navigator.clipboard.writeText(link).then(done, () => {}); } catch (e) { /* no clipboard */ }
  };
  const statusText = {
    checking: ['', 'Checking whether it is live…'],
    noid: ['warn', 'Give the study an id (top left) to get its link.'],
    unpublished: ['warn', <>Not published yet. To publish: <b>Download</b> the file, then upload it to <a href={UPLOAD_URL} target="_blank" rel="noreferrer">the study folder on GitHub</a> as a pull request and merge it. The link works a minute later.</>],
    changed: ['warn', <>Live, but this draft has changes that aren't published yet; participants get the published version. To publish them: <b>Download</b>, then upload the file to <a href={UPLOAD_URL} target="_blank" rel="noreferrer">the study folder on GitHub</a> with the same name.</>],
    live: ['ok', 'Live, and the same as this draft.'],
  }[status];
  return (
    <fieldset className="lb-fieldset lb-link-box">
      <legend>Study link</legend>
      <div className="lb-link-row">
        <code className="lb-link" aria-label="Study link">{link}</code>
        <Button size="small" variant="outlined" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        <Button size="small" href={link.replace(PROLIFIC_QUERY, '')} target="_blank" rel="noreferrer" disabled={status !== 'live' && status !== 'changed'}>Open</Button>
      </div>
      <div className="lb-link-opts">
        <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)} aria-label="Language">
          {Object.entries(LANGS).map(([k, l]) => <ToggleButton key={k} value={k}>{l.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <FormControlLabel control={<Checkbox size="small" checked={prolific} onChange={(e) => setProlific(e.target.checked)} />}
          label={<span className="lb-muted">For Prolific (records each participant's Prolific IDs)</span>} />
      </div>
      <div className={`lb-link-status lb-link-status-${statusText[0]}`} role="status">{statusText[1]}</div>
    </fieldset>
  );
}

function SettingsEditor({ ctx }) {
  const note = (ctx.study.metadata && ctx.study.metadata.note) || '';
  return (
    <section className="lb-editor" aria-label="Study settings">
      <div className="lb-editor-head"><div><div className="lb-kicker">Study</div><h2>Settings</h2></div></div>
      <Issues items={ctx.issuesFor('settings')} />
      <StudyLink study={ctx.study} />
      <ObjectFields ctx={ctx} path={[]} node={studySchema} skip={['views', 'strings', '$schema', 'metadata', 'conditon', 'studyId']} />
      <div className="lb-field lb-field-after">
        <TextField label="Notes for researchers (not shown to participants)" value={note} multiline minRows={2} fullWidth size="small"
          onChange={(e) => ctx.setStudy((s) => setIn(s, ['metadata'], { ...(s.metadata || {}), note: e.target.value || undefined }))} />
      </div>
    </section>
  );
}

// ----- preview -----
const PREVIEW_MIN = 320;
const PREVIEW_DEFAULT = 430;
const clampPreview = (w) => Math.round(Math.max(PREVIEW_MIN, Math.min(w, window.innerWidth - 560)));

function Preview({ study, startIndex, lang, width, onWidth }) {
  const frame = useRef(null);
  const [resizing, setResizing] = useState(false);
  // drag the left edge to make the preview wider or narrower; double-click resets
  const startResize = (e) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setResizing(true);
    const right = handle.parentElement.getBoundingClientRect().right;
    const move = (ev) => onWidth(clampPreview(right - ev.clientX));
    const up = () => {
      setResizing(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const nudge = (e) => {
    if (e.key === 'ArrowLeft') onWidth(clampPreview(width + 20));
    if (e.key === 'ArrowRight') onWidth(clampPreview(width - 20));
  };
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);
  const send = useCallback(() => {
    const w = frame.current && frame.current.contentWindow;
    if (w) w.postMessage({ type: 'lens-preview', experiment: study, startIndex }, window.location.origin);
  }, [study, startIndex]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin === window.location.origin && e.data && e.data.type === 'lens-preview-ready' && frame.current && e.source === frame.current.contentWindow) setReady(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  useEffect(() => { setReady(false); }, [lang, nonce]);
  useEffect(() => {
    if (!ready) return undefined;
    const id = setTimeout(send, 350); // let typing settle
    return () => clearTimeout(id);
  }, [ready, send]);

  return (
    <aside className={`lb-preview ${resizing ? 'lb-resizing' : ''}`} aria-label="Preview">
      <div className="lb-resize" role="separator" aria-orientation="vertical" aria-label="Preview width" tabIndex={0}
        aria-valuenow={width} aria-valuemin={PREVIEW_MIN} title="Drag to resize the preview (double-click to reset)"
        onPointerDown={startResize} onDoubleClick={() => onWidth(PREVIEW_DEFAULT)} onKeyDown={nudge} />
      <div className="lb-preview-head">
        <span>Preview <span className="lb-muted">· {resizing ? `${Math.round(width - 48)} px wide` : 'nothing is saved'}</span></span>
        <Button size="small" onClick={() => setNonce((n) => n + 1)}>Restart</Button>
      </div>
      <div className="lb-phone">
        <iframe key={`${lang}-${nonce}`} ref={frame} title="Study preview" src={`${PUBLIC}/#/__preview/${lang}`} />
      </div>
    </aside>
  );
}

// ----- the builder -----
export default function Builder() {
  const [draft, setDraft] = useState(() => loadDraft() || { study: emptyStudy(), lang: 'en' });
  const { study, lang } = draft;
  const mode = draft.mode === 'json' ? 'json' : 'form';
  const previewWidth = Number(draft.previewWidth) || PREVIEW_DEFAULT;
  const [selected, setSelected] = useState(0);
  const [jump, setJump] = useState(0); // bumped when a page is picked, so the JSON view scrolls to it
  const selectPage = useCallback((i) => { setSelected(i); setJump((n) => n + 1); }, []);
  const [jsonError, setJsonError] = useState(null); // what's wrong with the JSON being typed, if anything
  const jsonValid = !jsonError;
  const [locales, setLocales] = useState({ en: {}, fa: {}, ar: {} });
  const [templates, setTemplates] = useState({});
  const [dialog, setDialog] = useState(null); // 'open' | 'published' | 'new'
  const [openId, setOpenId] = useState('');
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const setStudy = useCallback((fn) => setDraft((d) => ({ ...d, study: typeof fn === 'function' ? fn(d.study) : fn })), []);
  const setLang = (l) => setDraft((d) => ({ ...d, lang: l }));
  const setMode = (m) => {
    if (m === 'form' && !jsonValid) setMessage('The JSON had an error, so the form shows its last valid version.');
    setJsonError(null);
    setDraft((d) => ({ ...d, mode: m }));
  };

  useEffect(() => { saveDraft(draft); }, [draft]);
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => { document.title = 'Lens study builder'; }, []);

  // shared locale files (to show text from existing keys) and page templates from the demo studies
  useEffect(() => {
    Promise.all(['en', 'fa', 'ar'].map((l) => fetchJson(`${PUBLIC}/locales/${l}.json`).catch(() => ({}))))
      .then(([en, fa, ar]) => setLocales({ en, fa, ar }));
  }, []);
  useEffect(() => {
    if (!Object.keys(locales.en).length) return;
    Promise.all(['demo-lens2', 'demo-multiplayer', 'demo-comprehensive'].map((id) => fetchJson(`${PUBLIC}/experiments/${id}.json`).catch(() => ({ views: [] }))))
      .then((studies) => {
        const t = {};
        for (const s of studies) for (const v of s.views || []) {
          if (t[v.type]) continue;
          // the first page of each type, as a starting point; skip the intro-only text pages
          if ((v.type === 'text2' || v.type === 'text') && v.instruction) continue;
          if (v.type === 'matrix2' && (v.questions || []).length < 2) continue; // prefer a real scale
          t[v.type] = plainCopy(v, locales);
        }
        t.text2 = { type: 'text2', text: 'Your question here', required: true };
        setTemplates(t);
      });
  }, [locales]);

  const checker = useMemo(() => makeChecker({ schema: studySchema, locales }), [locales]);
  const [issues, setIssues] = useState({ errors: [], warnings: [], notes: [] });
  useEffect(() => {
    const id = setTimeout(() => {
      try { setIssues(checker(study, study.studyId)); } catch (e) { setIssues({ errors: [{ text: String(e.message), view: null }], warnings: [], notes: [] }); }
    }, 250);
    return () => clearTimeout(id);
  }, [study, checker]);

  const all = useMemo(() => [
    ...issues.errors.map((x) => ({ ...x, level: 'error' })),
    ...issues.warnings.map((x) => ({ ...x, level: 'warn' })),
  ], [issues]);
  const issuesFor = (where) => all.filter((x) => (where === 'settings' ? x.view === null : x.view === where));
  const issueCount = (where) => issuesFor(where).length;
  const errorsByPath = useMemo(() => {
    const m = {};
    for (const x of issues.errors) if (x.path) (m[x.path] = m[x.path] || []).push(x.text.replace(/^[^:]*:\s*/, ''));
    return m;
  }, [issues]);

  const ctx = { study, setStudy, lang, locales, errorsByPath, issuesFor };
  const views = study.views || [];
  const sel = selected === 'settings' || views.length === 0 ? 'settings' : Math.min(selected, views.length - 1);

  // ----- page actions -----
  const addPage = (type) => {
    const base = templates[type] ? JSON.parse(JSON.stringify(templates[type])) : { type };
    base.type = type;
    base.id = freshId(study, ID_BASE[type] || type);
    const at = sel === 'settings' ? views.length : sel + 1;
    setStudy((s) => ({ ...s, views: [...(s.views || []).slice(0, at), base, ...(s.views || []).slice(at)] }));
    selectPage(at);
  };
  const movePage = (i, j) => {
    setStudy((s) => { const v = [...s.views]; const [x] = v.splice(i, 1); v.splice(j, 0, x); return { ...s, views: v }; });
    selectPage(j);
  };
  const duplicatePage = (i) => {
    setStudy((s) => {
      const copy = JSON.parse(JSON.stringify(s.views[i]));
      copy.id = freshId(s, s.views[i].id);
      const v = [...s.views];
      v.splice(i + 1, 0, copy);
      return { ...s, views: v };
    });
    selectPage(i + 1);
  };
  const deletePage = (i) => {
    setStudy((s) => ({ ...s, views: s.views.filter((_, j) => j !== i) }));
    selectPage(Math.max(0, i - 1));
  };
  const renamePage = (i, id) => setStudy((s) => setIn(s, ['views', i, 'id'], id));

  // ----- files -----
  const openStudy = (s, label) => {
    if (!s || !Array.isArray(s.views)) { setMessage('That file is not a Lens study (it has no "views").'); return; }
    setDraft((d) => ({ ...d, study: s }));
    selectPage(0);
    setDialog(null);
    setMessage(`Opened ${label}.`);
  };
  const openPublished = () => {
    const id = openId.trim().replace(/\.json$/, '');
    if (!id) return;
    fetchJson(`${PUBLIC}/experiments/${encodeURIComponent(id)}.json`)
      .then((s) => openStudy({ studyId: id, ...s }, `${id}.json`))
      .catch(() => setMessage(`No published study called "${id}".`));
  };
  const openFile = (file) => {
    const r = new FileReader();
    r.onload = () => {
      try { openStudy(JSON.parse(r.result), file.name); } catch (e) { setMessage(`${file.name} is not valid JSON.`); }
    };
    r.readAsText(file);
  };
  const download = () => {
    const out = pruneStrings(study);
    const name = `${(study.studyId || 'study').replace(/[^\w.-]+/g, '-')}.json`;
    const blob = new Blob([`${JSON.stringify(out, null, 2)}\n`], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setDialog('published');
  };

  const usedLangs = ['en', ...Object.keys(study.strings || {}).filter((l) => l !== 'en')];
  const errorCount = issues.errors.length;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="lb-app">
        <header className="lb-top">
          <div className="lb-brand">Lens <span>study builder</span></div>
          <TextField size="small" label="Study id (file name)" value={study.studyId || ''} sx={{ width: 220 }}
            onChange={(e) => setStudy((s) => ({ ...s, studyId: e.target.value.replace(/[^\w.-]/g, '') }))} />
          <div className="lb-langs">
            <span className="lb-muted">Editing</span>
            <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)}>
              {Object.entries(LANGS).map(([k, l]) => (
                <ToggleButton key={k} value={k}>{l.label}{usedLangs.includes(k) && k !== 'en' ? ' ·' : ''}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <span className="lb-spacer" />
          <Chip size="small" color={errorCount ? 'error' : 'success'} variant="outlined"
            label={errorCount ? `${errorCount} problem${errorCount === 1 ? '' : 's'}` : 'Ready to publish'} />
          <Button startIcon={<NewIcon />} onClick={() => setDialog('new')}>New</Button>
          <Button startIcon={<OpenIcon />} onClick={() => setDialog('open')}>Open</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={download}>Download</Button>
        </header>
        {message && <div className="lb-message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage(null)}>Dismiss</button></div>}

        <main className="lb-main" style={{ '--lb-preview-w': `${previewWidth}px` }}>
          <PageList study={study} selected={sel} onSelect={selectPage} onAdd={addPage} onMove={movePage}
            onDuplicate={duplicatePage} onDelete={deletePage} issueCount={issueCount} lang={lang} locales={locales} />
          <div className={`lb-center lb-center-${mode}`}>
            <div className="lb-center-bar">
              <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Edit with">
                <ToggleButton value="form">Form</ToggleButton>
                <ToggleButton value="json">JSON</ToggleButton>
              </ToggleButtonGroup>
              {mode === 'json' && (
                <span className={`lb-json-status ${jsonValid ? '' : 'lb-json-status-bad'}`} role="status">
                  {jsonValid ? 'Edits apply as you type' : `${jsonError}. Until it's fixed, the preview shows the last valid version.`}
                </span>
              )}
            </div>
            <div key={mode} className="lb-center-body">
              {mode === 'json' ? (
                <Suspense fallback={<p className="lb-muted">Loading…</p>}>
                  <JsonEditor study={study} onChange={(s) => setStudy(s)} onValid={(ok, why) => setJsonError(ok ? null : why)}
                    selected={sel} jump={jump} onCursorPage={setSelected} issues={all} />
                </Suspense>
              ) : sel === 'settings'
                ? <SettingsEditor ctx={ctx} />
                : <PageEditor key={sel} ctx={ctx} index={sel} onRename={(id) => renamePage(sel, id)} />}
            </div>
          </div>
          <Preview study={study} startIndex={sel === 'settings' ? 0 : sel} lang={lang}
            width={previewWidth} onWidth={(w) => setDraft((d) => ({ ...d, previewWidth: w }))} />
        </main>

        <input ref={fileInput} type="file" accept=".json,application/json" hidden
          onChange={(e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; }} />

        <Dialog open={dialog === 'open'} onClose={() => setDialog(null)} maxWidth="xs" fullWidth PaperProps={{ className: "lb-dialog" }}>
          <DialogTitle>Open a study</DialogTitle>
          <DialogContent>
            <p className="lb-dialog-p">A published study, by its id (the part of the link before the language):</p>
            <div className="lb-row">
              <TextField size="small" fullWidth autoFocus placeholder="e.g. demo-lens2" value={openId}
                onChange={(e) => setOpenId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && openPublished()} />
              <Button variant="contained" onClick={openPublished}>Open</Button>
            </div>
            <p className="lb-dialog-p">Or a study file from your computer:</p>
            <Button variant="outlined" onClick={() => fileInput.current.click()}>Choose file…</Button>
            <p className="lb-help">Opening replaces the study in the builder. Download it first if you want to keep it.</p>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'new'} onClose={() => setDialog(null)} maxWidth="xs" fullWidth PaperProps={{ className: "lb-dialog" }}>
          <DialogTitle>Start a new study?</DialogTitle>
          <DialogContent><p className="lb-dialog-p">This replaces the study in the builder. Download it first if you want to keep it.</p></DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="contained" onClick={() => { openStudy(emptyStudy(), 'a new study'); }}>New study</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={dialog === 'published'} onClose={() => setDialog(null)} maxWidth="sm" fullWidth PaperProps={{ className: "lb-dialog" }}>
          <DialogTitle>Downloaded {(study.studyId || 'study')}.json</DialogTitle>
          <DialogContent>
            {errorCount > 0 && <p className="lb-dialog-p lb-warn-text">It still has {errorCount} problem{errorCount === 1 ? '' : 's'}; fix {errorCount === 1 ? 'it' : 'them'} before publishing.</p>}
            <p className="lb-dialog-p">To publish it:</p>
            <ol className="lb-steps">
              <li>Open <a href={UPLOAD_URL} target="_blank" rel="noreferrer">the study folder on GitHub</a> and drag the file in.</li>
              <li>Choose <b>Create a new branch… and start a pull request</b>, then <b>Propose changes</b>.</li>
              <li>Once the checks pass, merge it. The study is live a minute later at<br />
                <code>lens.cut.social/#/{study.studyId || 'study'}/en</code></li>
            </ol>
            <p className="lb-help">Changing a published study? Upload the file with the same name; GitHub shows what changed.</p>
          </DialogContent>
          <DialogActions><Button onClick={() => setDialog(null)}>Done</Button></DialogActions>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

export { humanize };
