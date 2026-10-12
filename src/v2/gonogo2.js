/**
 * Two-choice task, Lens 2 ("type": "gonogo2").
 *
 * The Lens 2 version of classic "gonogo" (src/gonogo.js), which despite its
 * name is a 2-alternative forced choice task: a star appears on the left or
 * right; for the "go" star press the key on the same side, for the "no-go"
 * star press the key on the opposite side. Classic "gonogo" keeps its name
 * and is unchanged, so existing studies run exactly as before.
 *
 * Same study-file options, stimulus stream and data fields as classic; the
 * response adds taskVersion: 2.
 *
 * Classic rules kept exactly:
 *  - stream: trials.leftGo left-go, (go − leftGo) right-go,
 *    (left − leftGo) left-no-go, the rest right-no-go, shuffled once
 *    (starting again after too many timeouts keeps the order)
 *  - ← / → (or tapping a side) records `choice`: the stimulus's name
 *    (choices.go or choices.nogo) for the side it is on, "empty" for the other side
 *  - correct = go stimulus answered on its side, or no-go stimulus answered on the
 *    opposite side
 *  - a timeout records choice, correct, respondedAt and rt as null, counts
 *    toward timeoutsBeforeReset, and shows "incorrect" feedback (when feedback is on)
 *  - stimuli keep the classic icons, colors and size (45% of the page width),
 *    on the classic lighter square that marks each side
 *
 * Optional: "startText" (an i18n key) replaces the start-screen instructions
 * (classic: "gonogo.are_you_ready"); "showFixation": true shows a "+" during
 * fixation, which classic drew invisible.
 *
 * Changed on purpose:
 *  - the two sides are always drawn, so the layout doesn't jump between trials
 *  - the sides are always left-to-right, so in Persian/Arabic the left key
 *    matches the left side
 *  - only one response is accepted per trial (the shared trial engine)
 */
import React, { useState } from 'react';
import { Star, RadioButtonUnchecked as Circle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import '../gonogo.css';
import { shuffle } from '../utils/random';
import { languages } from '../utils/i18n';
import useTrialRunner from './useTrialRunner';
import { L2Root, Header, Text, StartCard, NoticeCard, Feedback } from './components';

/** The stream, built exactly as classic builds it. */
export function buildStream(trials) {
  return [...Array(trials.total).keys()].map((i) => {
    if (i < trials.leftGo) return 'left-go';
    if (i < trials.go) return 'right-go';
    if (i < trials.go + (trials.left - trials.leftGo)) return 'left-nogo';
    return 'right-nogo';
  });
}

/** What a response on `side` records for stimulus `spec` (e.g. "left-nogo"). */
export function responseFor(side, spec, choices) {
  const stimulusSide = spec.startsWith('left') ? 'left' : 'right';
  const isNoGo = spec.endsWith('nogo');
  const choice = side !== stimulusSide ? 'empty' : (isNoGo ? choices.nogo : choices.go);
  const correct = (choice === choices.go && !isNoGo) || (choice === 'empty' && isNoGo);
  return { stimuli: spec, choice, correct };
}

/** Classic stimulus drawings, by name. ("yellow-circle" drew a yellow star in classic, and still does.) */
const FIGURES = {
  star: [Star, 'yellow'],
  'blue-star': [Star, 'blue'],
  circle: [Circle, 'blue'],
  'yellow-circle': [Star, 'yellow'],
};

function Figure({ name }) {
  const entry = FIGURES[name];
  if (!entry) return null;
  const [Icon, color] = entry;
  return <Icon className={`${color} l2-side-figure`} aria-hidden="true" />;
}

export default function GoNoGo2({ content, onStore, onProgress }) {
  const {
    text, trials, choices, stimuliDuration, fixationDuration, feedbackDuration,
    timeoutsBeforeReset, startText, showFixation,
  } = content;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';

  // Trial order is fixed once per mount, as in classic (a restart keeps it).
  const [stream] = useState(() => shuffle(buildStream(trials)));

  const runner = useTrialRunner({
    trials: stream,
    fixationDuration,
    stimulusDuration: stimuliDuration,
    feedbackDuration,
    timeoutsBeforeReset,
    timeoutFields: (spec) => ({ stimuli: spec, choice: null, correct: null }),
    keyResponse: (key, spec) => {
      if (key === 'ArrowLeft') return responseFor('left', spec, choices);
      if (key === 'ArrowRight') return responseFor('right', spec, choices);
      return null;
    },
    onFinish: (response) => onStore({ view: content, response: { ...response, taskVersion: 2 } }, true),
    onProgress,
  });

  const { phase, spec } = runner;

  if (phase === 'start') {
    return (
      <L2Root dir={dir}>
        <StartCard
          keys={['←', '→']}
          instructions={t(startText || 'gonogo.are_you_ready')}
          spaceLabel={t('lens2.space')}
          startLabel={t('lens2.start')}
          hint={t('lens2.tap_start_hint')}
          onStart={runner.start}
        />
      </L2Root>
    );
  }

  if (phase === 'reset') {
    return (
      <L2Root dir={dir}>
        <NoticeCard message={t('lens2.too_many_timeouts')} actionLabel={t('lens2.restart')} onAction={runner.start} />
      </L2Root>
    );
  }

  const shownTrial = Math.min(phase === 'fixation' ? runner.trial + 1 : runner.trial, runner.total);
  const showStimulus = phase === 'stimulus' && spec;
  const stimulusSide = showStimulus ? (spec.startsWith('left') ? 'left' : 'right') : null;
  const stimulusName = showStimulus ? (spec.endsWith('nogo') ? choices.nogo : choices.go) : null;
  const sideLabels = { left: t('lens2.side_left'), right: t('lens2.side_right') };

  return (
    <L2Root dir={dir}>
      <Header start={t('lens2.trial_counter', { trial: shownTrial, trials: runner.total })} />
      <Text source={t(text)} className="l2-rule" />

      <div className="l2-stage l2-sides" dir="ltr" aria-live="off">
        {['left', 'right'].map((side) => (
          <button
            key={side}
            type="button"
            className="l2-side"
            aria-label={sideLabels[side]}
            aria-disabled={!showStimulus}
            onClick={(e) => { if (showStimulus) runner.respond(responseFor(side, spec, choices), e); }}
          >
            {stimulusSide === side && <Figure name={stimulusName} />}
          </button>
        ))}
        {phase === 'feedback' && (
          <div className="l2-sides-overlay">
            <Feedback correct={runner.correct} correctLabel={t('lens2.correct')} incorrectLabel={t('lens2.incorrect')} />
          </div>
        )}
        {phase === 'fixation' && showFixation && (
          <div className="l2-sides-overlay"><span className="l2-fixation" aria-hidden="true">+</span></div>
        )}
      </div>

      <p className="l2-hint">{t('lens2.tap_side_or_arrows')}</p>
    </L2Root>
  );
}
