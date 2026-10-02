/**
 * Final page, Lens 2. Shown after the last view of any study that uses a
 * Lens 2 view type (or "finalPage": "lens2"; "finalPage": "classic" opts out).
 * Sends exactly as the classic page does (utils/useSubmission.js).
 *
 * - A ring fills while the responses are saved, completes, then turns into a
 *   check with "Thank you! Your responses have been recorded."
 * - If every attempt fails, it says the save couldn't be confirmed instead of
 *   claiming it was recorded.
 * - Study fields: `submissionNote` (optional, markdown, gets
 *   {{submissionCode}}) under the thanks; `redirectTo` adds a button at the
 *   bottom, with optional `redirectText` (markdown above it, also gets
 *   {{submissionCode}}) and `redirectLabel` (button text, default "Continue").
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import useSubmission from '../utils/useSubmission';
import { L2Root, Text } from './components';
import { useDir } from './survey';

const MIN_SAVING_MS = 1200;   // the ring always gets to visibly fill
const COMPLETE_MS = 450;      // ring closes, then the message appears

const R = 42;
const CIRC = 2 * Math.PI * R;

const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Ring({ progress, tone, closing, done }) {
  return (
    <div className={`l2-ring l2-ring-${tone} ${closing ? 'is-closing' : ''} ${done ? 'is-done' : ''}`} aria-hidden="true">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={R} className="l2-ring-track" />
        <circle
          cx="52" cy="52" r={R}
          className="l2-ring-fill"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div className="l2-ring-icon">
        {tone === 'caution'
          ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="6.5" x2="12" y2="13.5" /><line x1="12" y1="17.5" x2="12" y2="17.5" /></svg>
          : <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12.5 10 17 19 7" /></svg>}
      </div>
    </div>
  );
}

export default function Submission2({ submission, studyId, experiment, submissionId }) {
  const { t } = useTranslation();
  const dir = useDir();
  const { status, submissionCode } = useSubmission(submission, studyId, submissionId);
  const { submissionNote, redirectTo, redirectText, redirectLabel } = experiment;
  const debug = process.env.NODE_ENV !== 'production';

  // phase: saving -> complete (ring closes) -> done (message shows)
  const [phase, setPhase] = useState('saving');
  const [progress, setProgress] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    // Two frames, so the empty ring is painted before it starts to fill.
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => setProgress(0.9)); });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (status === 'sending') return undefined;
    const quick = reducedMotion();
    const wait = quick ? 0 : Math.max(0, MIN_SAVING_MS - (Date.now() - mountedAt.current));
    const timers = [];
    timers.push(setTimeout(() => {
      setProgress(1);
      setPhase('complete');
      timers.push(setTimeout(() => setPhase('done'), quick ? 0 : COMPLETE_MS));
    }, wait));
    return () => timers.forEach(clearTimeout);
  }, [status]);

  const failed = status === 'failed';
  const done = phase === 'done';

  return (
    <L2Root dir={dir}>
      <div className="l2-final">
        <Ring progress={progress} tone={failed && phase !== 'saving' ? 'caution' : 'accent'} closing={phase !== 'saving'} done={done} />
        <div className="l2-final-text" role="status" aria-live="polite">
          {!done && (
            <>
              <p className="l2-final-title">{t('lens2.final.saving')}</p>
              <p className="l2-final-body">{t('lens2.final.keep_open')}</p>
            </>
          )}
          {done && (
            <div className="l2-final-message">
              <h1 className="l2-final-title">{t('lens2.final.thanks')}</h1>
              <p className="l2-final-body">{t(failed ? 'lens2.final.not_confirmed' : 'lens2.final.recorded')}</p>
            </div>
          )}
        </div>
        {done && submissionNote && (
          <Text source={t(submissionNote, { submissionCode })} className="l2-survey-text l2-final-note" />
        )}
      </div>

      <div className="l2-survey-spacer" />

      {done && redirectTo && (
        <div className="l2-final-redirect">
          {redirectText && <Text source={t(redirectText, { submissionCode })} className="l2-survey-text l2-final-redirect-text" />}
          <a className="l2-btn l2-btn-primary l2-btn-link" href={redirectTo}>{t(redirectLabel || 'finish_and_redirect')}</a>
        </div>
      )}

      {debug && (
        <details className="l2-debug">
          <summary>Submission (development only)</summary>
          <pre>{JSON.stringify(submission, null, 2)}</pre>
        </details>
      )}
    </L2Root>
  );
}
