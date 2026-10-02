/**
 * SingleResponseTask: shared Lens 2 component for tasks with one possible
 * response (tap the stimulus or press Space) where withholding a response is
 * the other answer: Go/No-Go (letters/icons) and N-back.
 *
 * Stimuli are drawn with the classic tasks' own CSS classes (nback.css), so
 * letters stay yellow #fced24 at 230px on a 300x300 tile, icons stay 300px,
 * and the fixation "+" keeps its classic size and opacity.
 *
 * Deliberate differences from classic: the whole stage is the tap target,
 * not only the 300px tile, and the tile's lighter background is gone (it
 * only marked where to click). Keyboard responses are unaffected.
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import {
  Star, RadioButtonUnchecked as Circle, CheckBoxOutlineBlank as Rectangle,
  ChangeHistory as Triangle, PanTool as Hand, SportsSoccer as Ball, Watch,
  School, FreeBreakfast as Cup, Add, Block,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import '../nback.css';
import { languages } from '../utils/i18n';
import useTrialRunner from './useTrialRunner';
import { L2Root, Header, Text, StartCard, Feedback } from './components';

const NO_RESPONSE = 'noresponse';
const iconFigures = { star: Star, circle: Circle, triangle: Triangle, rectangle: Rectangle, hand: Hand, ball: Ball, watch: Watch, school: School, cup: Cup };

/** The classic stimulus markup, unchanged except that the tile itself no longer handles clicks. */
function Stimulus({ stimulus }) {
  if (!stimulus) return null;
  if (stimulus.type === 'icon') {
    const Figure = iconFigures[stimulus.name] || Block;
    return (
      <Box className="single-stimulus single-stimulus-icon">
        <Figure fontSize="large" className="yellow single-stimulus-icon" />
      </Box>
    );
  }
  if (stimulus.type === 'letter') {
    return (
      <Box className="single-stimulus single-stimulus-letter" textAlign="center">
        <Typography type="span" className="yellow single-stimuli-letter"> {stimulus.name} </Typography>
      </Box>
    );
  }
  return null;
}

/**
 * @param {object} props
 * @param {object} props.content       the study view
 * @param {Array}  props.stream        stimuli in presentation order (built once by the task)
 * @param {(stim, trial, stream) => boolean} props.scoreResponse  correct when responding
 * @param {(stim, trial, stream) => boolean} props.scoreTimeout   correct when withholding
 * @param {(trial) => boolean} [props.canRespond]  false = response refused (N-back's first trials)
 * @param {string} [props.blockedMessage]  i18n key shown when a response is refused
 * @param {string} props.startTextDefault  classic start-screen i18n key
 * @param {string} props.fixationClass     classic fixation class
 */
export default function SingleResponseTask({
  content, onStore, onProgress, stream,
  scoreResponse, scoreTimeout, canRespond = () => true, blockedMessage,
  startTextDefault, fixationClass,
}) {
  const { text, stimuliDuration, fixationDuration, feedbackDuration, startText } = content;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!blocked) return undefined;
    const id = setTimeout(() => setBlocked(false), 2500);
    return () => clearTimeout(id);
  }, [blocked]);

  const responseFields = (stim, trial) => ({ stimuli: stim, choice: stim, correct: scoreResponse(stim, trial, stream) });
  const tryRespond = (stim, trial) => {
    if (!canRespond(trial)) { setBlocked(true); return null; }
    return responseFields(stim, trial);
  };

  const runner = useTrialRunner({
    trials: stream,
    fixationDuration,
    stimulusDuration: stimuliDuration,
    feedbackDuration,
    timeoutFields: (stim, trial, now) => ({
      stimuli: stim, choice: NO_RESPONSE, correct: scoreTimeout(stim, trial, stream), respondedAt: now,
    }),
    keyResponse: (key, stim, trial) => (key === ' ' ? tryRespond(stim, trial) : null),
    onFinish: (response) => onStore({ view: content, response: { ...response, taskVersion: 2 } }, true),
    onProgress,
  });

  const { phase, spec } = runner;

  if (phase === 'start') {
    return (
      <L2Root dir={dir}>
        <StartCard
          instructions={t(startText || startTextDefault)}
          spaceLabel={t('lens2.space')}
          startLabel={t('lens2.start')}
          hint={t('lens2.tap_start_hint')}
          onStart={runner.start}
        />
      </L2Root>
    );
  }

  const shownTrial = Math.min(phase === 'fixation' ? runner.trial + 1 : runner.trial, runner.total);
  const onStageTap = (event) => {
    if (phase !== 'stimulus' || !spec) return;
    const fields = tryRespond(spec, runner.trial);
    if (fields) runner.respond(fields, event);
  };

  return (
    <L2Root dir={dir}>
      <Header start={t('lens2.trial_counter', { trial: shownTrial, trials: runner.total })} />
      <Text source={t(text)} className="l2-rule" />

      {/* One element for every phase, so nothing moves; it only accepts taps while a stimulus is shown. */}
      <button type="button" className="l2-stage l2-stage-tap" onClick={onStageTap}
        aria-label={t('lens2.respond')} aria-disabled={phase !== 'stimulus'}>
        {phase === 'stimulus' && <Stimulus stimulus={spec} />}
        {phase === 'feedback' && (
          <Feedback correct={runner.correct} correctLabel={t('lens2.correct')} incorrectLabel={t('lens2.incorrect')} />
        )}
        {phase === 'fixation' && <Add fontSize="large" className={`${fixationClass} single-stimulus-icon`} aria-hidden="true" />}
      </button>

      <p className={`l2-hint ${blocked ? 'l2-hint-caution' : ''}`} role="status">
        {blocked ? t(blockedMessage) : t('lens2.tap_or_space')}
      </p>
    </L2Root>
  );
}
