/**
 * Lens 2 survey building blocks: the page shell (card layout, Next button,
 * scroll to top), the inline "please answer" message, a Likert slider and a
 * country picker. Used by text2, prolific2 and matrix2.
 *
 * Survey sizes are in rem (unlike the px-sized task screens), so a study's
 * optional `fontScale` enlarges survey text the same way it does in classic.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { languages } from '../utils/i18n';
import countries from '../utils/countries';
import { L2Root, Button } from './components';

export function useDir() {
  const { lang } = useParams();
  return (languages[lang] && languages[lang].direction) || 'ltr';
}

/** Page shell: content, then the Next button at the bottom of the screen. */
export function SurveyPage({ dir, nextLabel, onNext, children }) {
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  return (
    <L2Root dir={dir}>
      <div className="l2-survey">{children}</div>
      <div className="l2-survey-spacer" />
      <Button onClick={onNext}>{nextLabel}</Button>
    </L2Root>
  );
}

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><line x1="12" y1="7.5" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
  </svg>
);

/** Inline message under the question it is about (replaces the corner pop-up). */
export function FieldError({ id, message }) {
  return (
    <div id={id} className="l2-field-error" role="alert">
      <span className="l2-field-error-icon"><AlertIcon /></span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Likert slider. Stores 1..choices.length, like classic. Nothing is selected
 * until the participant taps, drags or uses the arrow keys, so no answer
 * looks preselected. Runs right to left in RTL languages, as classic did.
 */
export function ScaleSlider({ choices, value, onChange, labelledBy, describedBy, dir, showMidMark, hint, t }) {
  const n = choices.length;
  const railRef = useRef(null);
  const dragging = useRef(false);
  const pct = (v) => (n > 1 ? ((v - 1) / (n - 1)) * 100 : 50);

  const set = (v) => { if (v !== value) onChange(v); };
  const fromPointer = (e) => {
    const r = railRef.current.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (dir === 'rtl') f = 1 - f;
    f = Math.min(1, Math.max(0, f));
    return Math.round(f * (n - 1)) + 1;
  };
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    set(fromPointer(e));
  };
  const onPointerMove = (e) => { if (dragging.current) set(fromPointer(e)); };
  const stop = () => { dragging.current = false; };
  const onKeyDown = (e) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let v;
    if (e.key === forward || e.key === 'ArrowUp') v = value ? Math.min(n, value + 1) : 1;
    else if (e.key === back || e.key === 'ArrowDown') v = value ? Math.max(1, value - 1) : 1;
    else if (e.key === 'Home') v = 1;
    else if (e.key === 'End') v = n;
    else return;
    e.preventDefault();
    set(v);
  };

  const label = value ? t(choices[value - 1]) : hint;
  return (
    <div className="l2-scale">
      <div className={`l2-scale-readout ${value ? 'is-set' : ''}`} aria-hidden="true">{label}</div>
      <div
        className="l2-scale-hit"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={value || undefined}
        aria-valuetext={label}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKeyDown}
      >
        <div className="l2-scale-rail" ref={railRef}>
          <div className="l2-scale-track" />
          {choices.map((c, j) => (
            <span key={c + j} className="l2-scale-tick" style={{ insetInlineStart: `${pct(j + 1)}%` }} />
          ))}
          {value ? <span className="l2-scale-thumb" style={{ insetInlineStart: `${pct(value)}%` }} /> : null}
        </div>
      </div>
      <div className="l2-scale-marks" aria-hidden="true">
        <span>{t(choices[0])}</span>
        {showMidMark && <span>{t(choices[Math.floor(n / 2)])}</span>}
        <span>{t(choices[n - 1])}</span>
      </div>
    </div>
  );
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const flag = (code) => code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(ch.charCodeAt(0) + 127397));

/**
 * Country combobox. `value` is a country object or null; classic stores its
 * ISO code. Typing after a choice clears the choice, so what is stored always
 * matches what is shown. Leaving the field on an exact name selects it.
 */
export function CountryPicker({ value, onChange, label, noOptions, inputRef, labelledBy, describedBy, invalid }) {
  const [query, setQuery] = useState(value ? value.label : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef(null);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q || (value && query === value.label)) return countries;
    // Names starting with the text first, then names with a word starting with it, then the rest.
    const rank = (label) => (label.startsWith(q) ? 0 : (` ${label}`).includes(` ${q}`) ? 1 : 2);
    return countries
      .filter((c) => fold(c.label).includes(q))
      .map((c, i) => ({ c, i, r: rank(fold(c.label)) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.c);
  }, [query, value]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (c) => {
    onChange(c);
    setQuery(c.label);
    setOpen(false);
  };

  const onInput = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    setActive(0);
    if (value) onChange(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (open && matches[active]) { e.preventDefault(); choose(matches[active]); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onBlur = () => {
    setOpen(false);
    if (!value) {
      const exact = countries.find((c) => fold(c.label) === fold(query.trim()));
      if (exact) choose(exact);
    }
  };

  return (
    <div className="l2-combo">
      <input
        ref={inputRef}
        className={`l2-input ${invalid ? 'is-invalid' : ''}`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].code}` : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder={label}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={onInput}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="l2-listbox" role="listbox" id={listId} ref={listRef}>
          {matches.length === 0 && <li className="l2-listbox-empty" role="presentation">{noOptions}</li>}
          {matches.map((c, i) => (
            <li
              key={c.code}
              id={`${listId}-${c.code}`}
              role="option"
              aria-selected={value ? value.code === c.code : false}
              className={`l2-listbox-option ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c)}
            >
              <span aria-hidden="true">{flag(c.code)}</span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
