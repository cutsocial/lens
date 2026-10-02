/**
 * Lens 2 shared building blocks. Every Lens 2 task is assembled from these,
 * so start screens, notices, feedback and buttons look and behave the same
 * everywhere.
 */
import React, { useEffect } from 'react';
import Markdown from 'react-markdown/with-html';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/atkinson-hyperlegible-mono/700.css';
import './lens2.css';

/** Root of every Lens 2 view; switches the page ground while mounted. */
export function L2Root({ dir, children }) {
  useEffect(() => {
    const prev = document.body.getAttribute('data-ui');
    document.body.setAttribute('data-ui', '2');
    return () => {
      if (prev === null) document.body.removeAttribute('data-ui');
      else document.body.setAttribute('data-ui', prev);
    };
  }, []);
  return <div className="l2" dir={dir}>{children}</div>;
}

/** Markdown from an i18n string, rendered without wrapping margins. */
export function Text({ source, className }) {
  if (!source) return null;
  return <div className={className}><Markdown source={source} escapeHtml={false} /></div>;
}

export function Header({ start, end }) {
  return (
    <div className="l2-header">
      <span>{start}</span>
      <span>{end}</span>
    </div>
  );
}

export function Button({ variant = 'primary', children, ...rest }) {
  return <button type="button" className={`l2-btn l2-btn-${variant}`} {...rest}>{children}</button>;
}

export function Keys({ keys }) {
  if (!keys || keys.length === 0) return null;
  return (
    // Physical key layout is the same in every language, so never mirror it.
    <div className="l2-keys" aria-hidden="true" dir="ltr">
      {keys.map((k) => <div key={k} className="l2-key">{k}</div>)}
    </div>
  );
}

/**
 * Start screen shared by all tasks: key hints, instructions, Start button.
 * Space also starts the task (handled by the trial engine).
 */
export function StartCard({ keys, instructions, spaceLabel, startLabel, hint, onStart }) {
  return (
    <>
      <div className="l2-card" style={{ marginBlockStart: 'auto' }}>
        <Keys keys={keys} />
        <Text source={instructions} className="l2-body" />
        {spaceLabel && <div className="l2-key l2-key-wide" aria-hidden="true">{spaceLabel}</div>}
      </div>
      <Button onClick={onStart}>{startLabel}</Button>
      {hint && <p className="l2-hint" style={{ marginBlockEnd: 'auto' }}>{hint}</p>}
    </>
  );
}

/** A calm card for interruptions such as "too many timeouts, start over". */
export function NoticeCard({ message, actionLabel, onAction }) {
  return (
    <>
      <div className="l2-card" style={{ marginBlockStart: 'auto' }}>
        <Text source={message} className="l2-body" />
      </div>
      <Button onClick={onAction} style={{ marginBlockEnd: 'auto' }}>{actionLabel}</Button>
    </>
  );
}

const CheckIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="5 12.5 10 17 19 7" /></svg>
);
const CrossIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
);

/** Feedback after a trial: blue check for correct, orange cross otherwise. */
export function Feedback({ correct, correctLabel, incorrectLabel }) {
  return (
    <div className={`l2-feedback ${correct ? 'l2-feedback-correct' : 'l2-feedback-incorrect'}`} role="status">
      <div className="l2-feedback-icon">{correct ? <CheckIcon /> : <CrossIcon />}</div>
      <span>{correct ? correctLabel : incorrectLabel}</span>
    </div>
  );
}
