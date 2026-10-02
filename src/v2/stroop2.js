/**
 * Stroop, Lens 2 ("type": "stroop2").
 *
 * Same study-file options, trial logic and data fields as the classic Stroop
 * (src/stroop.js), presented in the Lens 2 design. Response records add
 * nothing new; the response object adds taskVersion: 2.
 *
 * Kept identical to classic:
 *  - correct = the chosen word names the stimulus's ink color
 *  - left arrow = first choice, right arrow = second choice; clicking a choice works too
 *  - stimulus word size and font (MUI h1, as classic) and ink colors from the study file
 *  - the fixation interval is blank (classic hid its cross); set "showFixation": true for a "+"
 *  - after a timeout, "incorrect" feedback is shown (when feedback is on)
 *
 * Changed on purpose:
 *  - the two choices stay in the same place between trials (empty while hidden), so the layout doesn't jump
 *  - the choice row is always left-to-right, so in Persian/Arabic the left key matches the left button
 *    (classic mirrored the buttons but not the keys)
 *  - randomization works on a copy; the classic code shuffled the study's trial list in place,
 *    so the echoed view config showed the shuffled order. Trial records are unaffected.
 */
import React, { useState } from 'react';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import shuffle from '../utils/shuffle';
import { languages } from '../utils/i18n';
import useTrialRunner from './useTrialRunner';
import { L2Root, Header, Text, StartCard, NoticeCard, Feedback } from './components';

export default function Stroop2({ content, onStore }) {
  const {
    rule, colors, words, trials,
    randomizeTrials, randomizeChoices,
    stimulusDuration, fixationDuration, feedbackDuration, timeoutsBeforeReset,
    showFixation,
  } = content;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';

  // Trial order is fixed once per mount, as in classic (a restart keeps it).
  const [ordered] = useState(() => {
    let ts = randomizeTrials ? shuffle([...trials]) : trials;
    if (randomizeChoices) ts = ts.map((tr) => ({ ...tr, choices: shuffle([...tr.choices]) }));
    return ts;
  });

  const fieldsFor = (choice, spec) => {
    const [choiceWord] = choice.split('');
    const [, stimulusColor] = spec.stimulus.split('');
    return { stimulus: spec.stimulus, choice, correct: choiceWord === stimulusColor };
  };

  const runner = useTrialRunner({
    trials: ordered,
    fixationDuration,
    stimulusDuration,
    feedbackDuration,
    timeoutsBeforeReset,
    timeoutFields: (spec) => ({ stimulus: spec.stimulus, choice: null, correct: null }),
    keyResponse: (key, spec) => {
      if (key === 'ArrowLeft') return fieldsFor(spec.choices[0], spec);
      if (key === 'ArrowRight') return fieldsFor(spec.choices[1], spec);
      return null;
    },
    onFinish: (response) => onStore({ view: content, response: { ...response, taskVersion: 2 } }, true),
  });

  const { phase, spec } = runner;

  if (phase === 'start') {
    return (
      <L2Root dir={dir}>
        <StartCard
          keys={['←', '→']}
          instructions={t('stroop.are_you_ready')}
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
  const keyLabels = [t('lens2.key_left'), t('lens2.key_right')];

  return (
    <L2Root dir={dir}>
      <Header start={t('lens2.trial_counter', { trial: shownTrial, trials: runner.total })} />
      <Text source={t(rule)} className="l2-rule" />

      <div className="l2-stage" aria-live="off">
        {showStimulus && (() => {
          const [word, color] = spec.stimulus.split('');
          return <Typography variant="h1" component="div" style={{ color: colors[color] }}>{t(words[word])}</Typography>;
        })()}
        {phase === 'feedback' && (
          <Feedback correct={runner.correct} correctLabel={t('lens2.correct')} incorrectLabel={t('lens2.incorrect')} />
        )}
        {phase === 'fixation' && showFixation && <span className="l2-fixation" aria-hidden="true">+</span>}
      </div>

      <div className="l2-choices" dir="ltr">
        {[0, 1].map((i) => {
          if (!showStimulus) {
            return <button key={i} type="button" className="l2-choice" disabled aria-hidden="true" tabIndex={-1} />;
          }
          const choice = spec.choices[i];
          const [word, color] = choice.split('');
          return (
            <button key={i} type="button" className="l2-choice" onClick={(e) => runner.respond(fieldsFor(choice, spec), e)}>
              <span className="l2-choice-label" style={{ color: colors[color] }}>{t(words[word])}</span>
              <span className="l2-choice-key" dir={dir}>{keyLabels[i]}</span>
            </button>
          );
        })}
      </div>
    </L2Root>
  );
}
