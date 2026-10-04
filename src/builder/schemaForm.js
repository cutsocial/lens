/**
 * Forms generated from schema/study.schema.json, so every page type and
 * option the schema knows can be edited, with the schema's descriptions as
 * help text. A few fields get their own editors: text (in the language being
 * edited), choice lists with "required" ticks, and the people in the token
 * games.
 */
import React, { useState } from 'react';
import {
  TextField, MenuItem, Switch, FormControlLabel, IconButton, Button, Tooltip, Checkbox,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, ArrowUpward as UpIcon, ArrowDownward as DownIcon,
} from '@mui/icons-material';

import schema from '../../schema/study.schema.json';
import { LANGS, getIn, setIn, textOf, setText, personKey, setKeyText } from './model';

// ----- schema helpers -----
export function resolve(node) {
  let n = node;
  for (let guard = 0; n && n.$ref && guard < 20; guard++) {
    const parts = n.$ref.replace(/^#\//, '').split('/');
    const target = parts.reduce((o, k) => (o ? o[k] : undefined), schema);
    // keep the referring node's own description / defaults on top
    const { $ref, ...own } = n;
    n = { ...target, ...own };
  }
  if (n && n.allOf) {
    const merged = { ...n };
    delete merged.allOf;
    for (const part of n.allOf) {
      const p = resolve(part);
      merged.type = merged.type || p.type;
      merged.properties = { ...(p.properties || {}), ...(merged.properties || {}) };
      merged.required = [...new Set([...(p.required || []), ...(merged.required || [])])];
    }
    return merged;
  }
  return n;
}
const isText = (node) => node && node.$ref === '#/$defs/i18n';
const I18N_DESC = schema.$defs.i18n.description;
export const viewSchema = (type) => resolve({ $ref: `#/$defs/${type}` });
export const studySchema = schema;

const LONG_TEXT = new Set(['text', 'rule', 'startText', 'dialogOptionalText', 'textBot', 'textHuman', 'redirectText', 'submissionNote']);

export function humanize(name) {
  const s = String(name).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function blankFor(node) {
  const n = resolve(node);
  if (!n) return '';
  if (n.const !== undefined) return n.const;
  if (n.enum) return n.enum[0];
  const t = Array.isArray(n.type) ? n.type[0] : n.type;
  if (t === 'integer' || t === 'number') return n.minimum || 0;
  if (t === 'boolean') return false;
  if (t === 'array') return [];
  if (t === 'object') {
    const o = {};
    for (const k of n.required || []) o[k] = blankFor(n.properties[k]);
    return o;
  }
  return '';
}

function Help({ node }) {
  const d = node && node.description;
  return d ? <div className="lb-help">{d}</div> : null;
}

function Errors({ ctx, path }) {
  const key = path.join('.');
  const list = ctx.errorsByPath[key];
  if (!list || !list.length) return null;
  return <div className="lb-field-error">{list.join(' · ')}</div>;
}

// ----- text in the language being edited -----
function TextInput({ ctx, path, node, label, keyHint, multiline }) {
  const value = getIn(ctx.study, path);
  const shown = textOf(ctx.study, value, ctx.lang, ctx.locales);
  const english = ctx.lang !== 'en' ? textOf(ctx.study, value, 'en', ctx.locales) : '';
  return (
    <div className="lb-field">
      <TextField
        label={label}
        value={shown}
        onChange={(e) => ctx.setStudy((s) => setText(s, path, ctx.lang, e.target.value, keyHint, ctx.locales))}
        placeholder={english || ''}
        fullWidth size="small" multiline={multiline} minRows={multiline ? 2 : undefined}
        inputProps={{ dir: LANGS[ctx.lang].dir }}
      />
      {english && <div className="lb-help">English: {english}</div>}
      {node.description !== I18N_DESC && <Help node={node} />}
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

function ListControls({ onUp, onDown, onRemove, upDisabled, downDisabled }) {
  return (
    <span className="lb-list-controls">
      <IconButton size="small" onClick={onUp} disabled={upDisabled} aria-label="Move up"><UpIcon fontSize="inherit" /></IconButton>
      <IconButton size="small" onClick={onDown} disabled={downDisabled} aria-label="Move down"><DownIcon fontSize="inherit" /></IconButton>
      <IconButton size="small" onClick={onRemove} aria-label="Remove"><DeleteIcon fontSize="inherit" /></IconButton>
    </span>
  );
}

const move = (arr, i, j) => {
  const a = [...arr];
  const [x] = a.splice(i, 1);
  a.splice(j, 0, x);
  return a;
};

/** A list of texts (choices, questions). With `requiredPath`, each line gets a "required" tick. */
function TextList({ ctx, path, node, label, keyBase, requiredPath }) {
  const items = getIn(ctx.study, path) || [];
  const required = requiredPath ? (getIn(ctx.study, requiredPath) || []) : null;
  const setBoth = (fn) => ctx.setStudy((s) => fn(s));
  const remapRequired = (s, mapIndex) => {
    if (!requiredPath) return s;
    const req = (getIn(s, requiredPath) || []).map(mapIndex).filter((x) => x !== null);
    return setIn(s, requiredPath, req.length ? req : undefined);
  };
  return (
    <div className="lb-field">
      <div className="lb-subhead">{label}</div>
      <Help node={node} />
      {items.map((item, i) => (
        <div className="lb-list-row" key={i}>
          <TextField
            value={textOf(ctx.study, item, ctx.lang, ctx.locales)}
            placeholder={ctx.lang !== 'en' ? textOf(ctx.study, item, 'en', ctx.locales) : ''}
            onChange={(e) => ctx.setStudy((s) => setText(s, [...path, i], ctx.lang, e.target.value, `${keyBase}.${i + 1}`, ctx.locales))}
            size="small" fullWidth inputProps={{ dir: LANGS[ctx.lang].dir }}
          />
          {required && (
            <Tooltip title="Must be answered" disableInteractive>
              <Checkbox size="small" checked={required.includes(i)}
                onChange={(e) => ctx.setStudy((s) => {
                  const req = new Set(getIn(s, requiredPath) || []);
                  if (e.target.checked) req.add(i); else req.delete(i);
                  const arr = [...req].sort((a, b) => a - b);
                  return setIn(s, requiredPath, arr.length ? arr : undefined);
                })} />
            </Tooltip>
          )}
          <ListControls
            upDisabled={i === 0} downDisabled={i === items.length - 1}
            onUp={() => setBoth((s) => remapRequired(setIn(s, path, move(items, i, i - 1)), (x) => (x === i ? i - 1 : x === i - 1 ? i : x)))}
            onDown={() => setBoth((s) => remapRequired(setIn(s, path, move(items, i, i + 1)), (x) => (x === i ? i + 1 : x === i + 1 ? i : x)))}
            onRemove={() => setBoth((s) => remapRequired(setIn(s, path, items.filter((_, j) => j !== i)), (x) => (x === i ? null : x > i ? x - 1 : x)))}
          />
        </div>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => ctx.setStudy((s) => setIn(s, path, [...items, '']))}>Add</Button>
      {required && <div className="lb-help">Tick the questions that must be answered.</div>}
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

/** A list of plain strings or numbers (tags, letters, icon names). */
function PlainList({ ctx, path, node, label, numeric }) {
  const items = getIn(ctx.study, path) || [];
  const [draft, setDraft] = useState(null);
  const text = draft !== null ? draft : items.join(', ');
  return (
    <div className="lb-field">
      <TextField
        label={label} size="small" fullWidth value={text}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          const parts = draft.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (numeric ? Number(x) : x));
          ctx.setStudy((s) => setIn(s, path, parts.length ? parts : undefined));
          setDraft(null);
        }}
        helperText="Separate with commas"
      />
      <Help node={node} />
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

/** code → value tables (Stroop colors and words). */
function MapField({ ctx, path, node, label, keyBase }) {
  const map = getIn(ctx.study, path) || {};
  const valueNode = node.additionalProperties;
  const textValues = isText(valueNode);
  const entries = Object.entries(map);
  const rename = (from, to) => ctx.setStudy((s) => {
    const cur = getIn(s, path) || {};
    const next = {};
    for (const [k, v] of Object.entries(cur)) next[k === from ? to : k] = v;
    return setIn(s, path, next);
  });
  return (
    <div className="lb-field">
      <div className="lb-subhead">{label}</div>
      <Help node={node} />
      {entries.map(([k, v]) => (
        <div className="lb-list-row" key={k}>
          <TextField size="small" label="Code" value={k} sx={{ width: 90 }}
            onChange={(e) => e.target.value && !(e.target.value in map) && rename(k, e.target.value)} />
          {textValues ? (
            <TextField size="small" fullWidth label="Text"
              value={textOf(ctx.study, v, ctx.lang, ctx.locales)}
              onChange={(e) => ctx.setStudy((s) => setText(s, [...path, k], ctx.lang, e.target.value, `${keyBase}.${k}`, ctx.locales))}
              inputProps={{ dir: LANGS[ctx.lang].dir }} />
          ) : (
            <>
              <TextField size="small" fullWidth label="Value" value={v}
                onChange={(e) => ctx.setStudy((s) => setIn(s, [...path, k], e.target.value))} />
              {/^#[0-9a-f]{3,8}$/i.test(v) && <span className="lb-swatch" style={{ background: v }} />}
            </>
          )}
          <IconButton size="small" aria-label="Remove" onClick={() => ctx.setStudy((s) => {
            const next = { ...(getIn(s, path) || {}) };
            delete next[k];
            return setIn(s, path, next);
          })}><DeleteIcon fontSize="inherit" /></IconButton>
        </div>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => {
        let code = 'A';
        for (let c = 65; c < 91 && String.fromCharCode(c) in map; c++) code = String.fromCharCode(c + 1);
        ctx.setStudy((s) => setIn(s, [...path, code], ''));
      }}>Add</Button>
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

/** A list of objects (Stroop trials, N-back stimuli): one compact card each. */
function ObjectList({ ctx, path, node, label }) {
  const items = getIn(ctx.study, path) || [];
  const itemNode = resolve(node.items);
  return (
    <div className="lb-field">
      <div className="lb-subhead">{label} <span className="lb-count">{items.length}</span></div>
      <Help node={node} />
      {items.map((_, i) => (
        <div className="lb-card" key={i}>
          <div className="lb-card-head">
            <span>{i + 1}</span>
            <ListControls
              upDisabled={i === 0} downDisabled={i === items.length - 1}
              onUp={() => ctx.setStudy((s) => setIn(s, path, move(getIn(s, path), i, i - 1)))}
              onDown={() => ctx.setStudy((s) => setIn(s, path, move(getIn(s, path), i, i + 1)))}
              onRemove={() => ctx.setStudy((s) => setIn(s, path, getIn(s, path).filter((__, j) => j !== i)))}
            />
          </div>
          <ObjectFields ctx={ctx} path={[...path, i]} node={itemNode} compact />
        </div>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => ctx.setStudy((s) => setIn(s, path, [...(getIn(s, path) || []), blankFor(itemNode)]))}>Add</Button>
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

/** The people in the dictator / ultimatum games. */
function PersonsField({ ctx, path, node }) {
  const viewIndex = path[1];
  const persons = getIn(ctx.study, path) || [];
  const view = ctx.study.views[viewIndex];
  const textFor = (p, field) => {
    if (!view.personsPrefix || !p[field]) return '';
    return textOf(ctx.study, `${view.personsPrefix}${p.id}.${p[field]}`, ctx.lang, ctx.locales);
  };
  const setPersonText = (i, field, text) => ctx.setStudy((s) => {
    const [key, next] = personKey(s, viewIndex, i, field);
    return setKeyText(next, key, ctx.lang, text);
  });
  const isUltimatum = /^ultimatum/.test(view.type);
  return (
    <div className="lb-field">
      <div className="lb-subhead">People <span className="lb-count">{persons.length}</span></div>
      <Help node={node} />
      {persons.map((p, i) => (
        <div className="lb-card" key={i}>
          <div className="lb-card-head">
            <span>Person {p.id}</span>
            <ListControls
              upDisabled={i === 0} downDisabled={i === persons.length - 1}
              onUp={() => ctx.setStudy((s) => setIn(s, path, move(getIn(s, path), i, i - 1)))}
              onDown={() => ctx.setStudy((s) => setIn(s, path, move(getIn(s, path), i, i + 1)))}
              onRemove={() => ctx.setStudy((s) => setIn(s, path, getIn(s, path).filter((__, j) => j !== i)))}
            />
          </div>
          <div className="lb-grid">
            <TextField size="small" label="Name" value={textFor(p, 'field1')} onChange={(e) => setPersonText(i, 'field1', e.target.value)} inputProps={{ dir: LANGS[ctx.lang].dir }} />
            <TextField size="small" label="Detail line 1" value={textFor(p, 'field2')} onChange={(e) => setPersonText(i, 'field2', e.target.value)} inputProps={{ dir: LANGS[ctx.lang].dir }} />
            <TextField size="small" label="Detail line 2" value={textFor(p, 'field3')} onChange={(e) => setPersonText(i, 'field3', e.target.value)} inputProps={{ dir: LANGS[ctx.lang].dir }} />
            <TextField size="small" label="Photo file (in public/images)" value={p.avatar || ''} onChange={(e) => ctx.setStudy((s) => setIn(s, [...path, i, 'avatar'], e.target.value || undefined))} />
            <TextField size="small" label="Tags" value={(p.tags || []).join(', ')} helperText="For opponent types; separate with commas"
              onChange={(e) => ctx.setStudy((s) => {
                const tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
                return setIn(s, [...path, i, 'tags'], tags.length ? tags : undefined);
              })} />
            {isUltimatum && (
              <TextField size="small" type="number" label="Accepts offers of at least" value={p.minAcceptable ?? ''}
                onChange={(e) => ctx.setStudy((s) => setIn(s, [...path, i, 'minAcceptable'], e.target.value === '' ? undefined : Number(e.target.value)))} />
            )}
          </div>
        </div>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={() => ctx.setStudy((s) => {
        const ps = getIn(s, path) || [];
        const id = ps.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
        return setIn(s, path, [...ps, { id }]);
      })}>Add person</Button>
      <Errors ctx={ctx} path={path} />
    </div>
  );
}

// ----- one field -----
function Field({ ctx, path, name, node: rawNode, parent }) {
  const node = resolve(rawNode);
  const label = humanize(name);
  const value = getIn(ctx.study, path);
  const keyBase = `${(ctx.study.views && path[0] === 'views' ? ctx.study.views[path[1]].id : 'study')}.${path.slice(2).join('.') || name}`;

  if (isText(rawNode)) {
    return <TextInput ctx={ctx} path={path} node={node} label={label} keyHint={keyBase} multiline={LONG_TEXT.has(name)} />;
  }
  if (name === 'persons') return <PersonsField ctx={ctx} path={path} node={node} />;
  if (node.const !== undefined) return null;

  const type = Array.isArray(node.type) ? node.type : [node.type];
  const errors = <Errors ctx={ctx} path={path} />;

  if (node.enum) {
    return (
      <div className="lb-field">
        <TextField select size="small" fullWidth label={label} value={value ?? ''}
          onChange={(e) => ctx.setStudy((s) => setIn(s, path, e.target.value === '' ? undefined : e.target.value))}>
          {!(parent.required || []).includes(name) && <MenuItem value=""><em>Default</em></MenuItem>}
          {node.enum.map((x) => <MenuItem key={String(x)} value={x}>{String(x)}</MenuItem>)}
        </TextField>
        <Help node={node} />{errors}
      </div>
    );
  }
  if (type.includes('boolean')) {
    return (
      <div className="lb-field">
        <FormControlLabel control={<Switch checked={value === true} onChange={(e) => ctx.setStudy((s) => setIn(s, path, e.target.checked ? true : (parent.required || []).includes(name) ? false : undefined))} />} label={label} />
        <Help node={node} />{errors}
      </div>
    );
  }
  if (type.includes('array')) {
    const items = node.items || {};
    if (isText(items)) {
      const requiredPath = name === 'questions' && parent.properties && parent.properties.requiredQuestions ? [...path.slice(0, -1), 'requiredQuestions'] : null;
      return <TextList ctx={ctx} path={path} node={node} label={label} keyBase={keyBase} requiredPath={requiredPath} />;
    }
    const it = resolve(items);
    const itType = Array.isArray(it.type) ? it.type[0] : it.type;
    if (itType === 'object') return <ObjectList ctx={ctx} path={path} node={node} label={label} />;
    return <PlainList ctx={ctx} path={path} node={node} label={label} numeric={itType === 'integer' || itType === 'number'} />;
  }
  if (type.includes('object')) {
    if (node.properties) {
      return (
        <fieldset className="lb-fieldset">
          <legend>{label}</legend>
          <Help node={node} />
          <ObjectFields ctx={ctx} path={path} node={node} />
          {errors}
        </fieldset>
      );
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      return <MapField ctx={ctx} path={path} node={node} label={label} keyBase={keyBase} />;
    }
    return null; // free-form objects (metadata) are handled by the page itself
  }
  if (type.includes('integer') || type.includes('number')) {
    return (
      <div className="lb-field">
        <TextField size="small" type="number" fullWidth label={label} value={value ?? ''}
          inputProps={{ step: type.includes('integer') ? 1 : 'any', min: node.minimum, max: node.maximum }}
          onChange={(e) => ctx.setStudy((s) => setIn(s, path, e.target.value === '' ? undefined : Number(e.target.value)))} />
        <Help node={node} />{errors}
      </div>
    );
  }
  // plain string
  return (
    <div className="lb-field">
      <TextField size="small" fullWidth label={label} value={value ?? ''}
        onChange={(e) => ctx.setStudy((s) => setIn(s, path, e.target.value === '' && !(parent.required || []).includes(name) ? undefined : e.target.value))} />
      <Help node={node} />{errors}
    </div>
  );
}

/** All fields of an object node, in schema order. `skip` hides some (type, id, deprecated). */
export function ObjectFields({ ctx, path, node, skip = [], compact }) {
  const n = resolve(node);
  const props = n.properties || {};
  return (
    <div className={compact ? 'lb-grid' : 'lb-fields'}>
      {Object.entries(props).map(([name, child]) => {
        if (skip.includes(name)) return null;
        if (name === 'requiredQuestions' && props.questions) return null; // shown as ticks on the questions
        const r = resolve(child);
        if (r && r.deprecated && getIn(ctx.study, [...path, name]) === undefined) return null;
        return <Field key={name} ctx={ctx} path={[...path, name]} name={name} node={child} parent={n} />;
      })}
    </div>
  );
}
