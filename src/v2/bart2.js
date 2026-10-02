/**
 * BART, Lens 2 ("type": "bart2").
 *
 * Same study-file options and data as classic "bart" (src/bart.js); the
 * response adds taskVersion: 2.
 *
 * Kept identical to classic:
 *  - explosion: each balloon has a shuffled deck 1..maxPumps; every pump draws
 *    one card at random and the balloon explodes on card 1. The first
 *    `safePumps` pumps draw nothing (but still use a random number, as classic)
 *  - balloon look (the classic translucent bubble) and size:
 *    diameter = ceil(2 * sqrt((pumps + 1) * 500 / pi)) px, times `ballScale`
 *  - score = pumps x reward when cashed, 0 when exploded
 *  - records: {trial, pumps, score, result}; taskStartedAt when the task
 *    appears, taskFinishedAt when the last result is dismissed (classic has
 *    no start screen, so neither does this)
 *
 * Changed on purpose:
 *  - the whole stage pumps, not only the balloon (it starts ~26px wide)
 *  - "Next Reward" is labelled "This round": it always showed points banked
 *  - results rise as a sheet inside the task instead of a full-height dialog
 *
 * Optional, for new studies (both change what participants see, and both are
 * recorded in the echoed view):
 *  - "ballScale" (default 1) enlarges the balloon
 *  - "stimulusStyle": "lens2" draws the balloon as a solid orange ball (the
 *    Lens 2 design) instead of the classic translucent red bubble
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import '../bart.css';
import { languages } from '../utils/i18n';
import { L2Root, Button } from './components';

// Classic BART's own in-place shuffle, kept so the random sequence matches.
const shuffleInPlace = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const freshDeck = (maxPumps) => shuffleInPlace(Array.from({ length: maxPumps }, (_, i) => i + 1));
const balloonSize = (pumps, scale) => Math.ceil(2 * Math.sqrt(((pumps + 1) * 500) / Math.PI) * scale);

export default function Bart2({ content, onStore }) {
  const { reward, maxPumps, safePumps, trials, ballScale, stimulusStyle } = content;
  const lens2Ball = stimulusStyle === 'lens2';
  const scale = Number(ballScale) > 0 ? Number(ballScale) : 1;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';

  const [taskStartedAt] = useState(() => Date.now());
  const deck = useRef(null);
  const [state, setState] = useState({
    trial: 1,
    pumps: 0,
    totalScore: 0,
    records: [],
    sheet: null, // the last record while its result sheet is showing
    pumpedOnce: false,
  });

  // Classic shuffles the first deck right after mounting; same order of random draws.
  useEffect(() => { deck.current = freshDeck(maxPumps); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rapid taps should pump, not zoom the page (as classic).
  useEffect(() => {
    document.body.style.touchAction = 'none';
    document.documentElement.style.touchAction = 'none';
    return () => {
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
    };
  }, []);

  const endBalloon = (cashed) => {
    // Classic shuffles the next balloon's deck at this moment; same order of random draws.
    deck.current = freshDeck(maxPumps);
    setState((s) => {
      const record = { trial: s.trial, pumps: s.pumps, score: cashed ? s.pumps * reward : 0, result: cashed ? 'cashed' : 'exploded' };
      // pumps stay as they were so the balloon (or its outline) stays under the sheet; Next resets them
      return { ...s, records: [...s.records, record], totalScore: s.totalScore + record.score, sheet: record, pumpedOnce: false };
    });
  };

  const pump = () => {
    if (state.sheet || !deck.current) return;
    const isSafe = safePumps > 0 && state.pumps < safePumps;
    const randomIndex = Math.floor(Math.random() * deck.current.length);
    const drawn = deck.current.splice(randomIndex, isSafe ? 0 : 1);
    if (drawn[0] === 1) endBalloon(false);
    else setState((s) => ({ ...s, pumps: s.pumps + 1, pumpedOnce: true }));
  };

  const cash = () => { if (!state.sheet) endBalloon(true); };

  const isLast = state.sheet && state.sheet.trial >= trials;

  const next = () => {
    if (isLast) {
      const now = Date.now();
      onStore({
        view: content,
        response: { trials: state.records, taskStartedAt, taskFinishedAt: now, taskDuration: now - taskStartedAt, taskVersion: 2 },
      }, true);
      return;
    }
    setState((s) => ({ ...s, sheet: null, pumps: 0, trial: s.trial + 1 }));
  };

  const exploded = state.sheet && state.sheet.result === 'exploded';
  const size = balloonSize(state.pumps, scale);
  const roundPoints = state.pumps * reward;

  return (
    <L2Root dir={dir}>
      <div className="l2-bart-stats" aria-live="polite">
        <div className="l2-stat">
          <span className="l2-stat-label">{t('lens2.bart.this_round')}</span>
          <span className="l2-stat-value">{state.sheet ? state.sheet.score : roundPoints}</span>
        </div>
        <span className="l2-chip">{t('bart.trial_label', { trial: Math.min(state.trial, trials), trials })}</span>
        <div className="l2-stat l2-stat-end">
          <span className="l2-stat-label">{t('bart.total_points')}</span>
          <span className="l2-stat-value">{state.totalScore}</span>
        </div>
      </div>

      <div className="l2-bart-area">
        <button type="button" className="l2-stage l2-stage-tap l2-bart-stage" onClick={pump}
          aria-label={t('bart.balloon_tooltip')} disabled={!!state.sheet}>
          {exploded
            ? <div className="l2-bart-popped" style={{ width: size, height: size }} aria-hidden="true" />
            : (
              <div className={lens2Ball ? 'l2-ball' : 'bubble-container'} aria-hidden="true" style={{
                width: size, height: size,
                transition: state.pumps === 0 ? '' : 'width 1s, height 1s',
              }}>
                {!lens2Ball && <figure className="bubble" />}
              </div>
            )}
          {!state.pumpedOnce && !state.sheet && <span className="l2-bart-hint">{t('lens2.bart.tap_hint')}</span>}
        </button>

        {state.sheet && (
          <div className="l2-sheet" role="dialog" aria-labelledby="l2-sheet-title">
            <div className="l2-sheet-grip" aria-hidden="true" />
            <h2 id="l2-sheet-title" className={`l2-sheet-title ${exploded ? 'l2-tone-caution' : 'l2-tone-accent'}`}>
              {exploded ? t('bart.exploded_title') : t('bart.cashed_title')}
            </h2>
            <div className="l2-sheet-stats">
              <div className="l2-stat-box">
                <span className="l2-stat-label">{t('lens2.bart.this_round')}</span>
                <span className={`l2-stat-value ${exploded ? 'l2-tone-caution' : ''}`}>{state.sheet.score}</span>
              </div>
              <div className="l2-stat-box">
                <span className="l2-stat-label">{t('bart.total_points')}</span>
                <span className="l2-stat-value">{state.totalScore}</span>
              </div>
            </div>
            <Button onClick={next} autoFocus>{isLast ? t('next') : t('bart.next_trial')}</Button>
          </div>
        )}
      </div>

      {!state.sheet && (
        <Button variant="secondary" onClick={cash}>
          {t('lens2.bart.cash_points', { points: roundPoints })}
        </Button>
      )}
    </L2Root>
  );
}
