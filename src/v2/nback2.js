/**
 * N-back, Lens 2 ("type": "nback2").
 * Same study-file options, stimulus stream and data fields as classic
 * "nback" (src/nback.js); the response adds taskVersion: 2.
 *
 * Classic rules kept exactly:
 *  - stream: each entry of `stimuli` repeated `amount` times, in order, up to
 *    `trials` (wrapping to the first entry if the amounts run out), then shuffled
 *  - responding is correct when the letter matches the one `nback` trials ago
 *  - withholding is correct when it doesn't match, and on the first `nback` trials
 *  - responses during the first `nback` trials are refused and not recorded;
 *    the trial keeps running. Classic showed a corner notification; Lens 2
 *    shows the same message in place of the hint under the stage.
 */
import React, { useState } from 'react';
import { shuffle } from '../utils/random';
import SingleResponseTask from './singleResponseTask';

function buildStream(trials, stimuli) {
  let figureIndex = 0;
  let figureTotal = 0;
  const stim = [...Array(trials).keys()].map(() => {
    let figure = stimuli[figureIndex];
    if (figureTotal < figure.amount) {
      figureTotal++;
      return { type: figure.type, name: figure.name };
    }
    figureIndex++;
    figureTotal = 1;
    if (figureIndex >= stimuli.length) figureIndex = 0;
    figure = stimuli[figureIndex];
    return { type: figure.type, name: figure.name };
  });
  return shuffle(stim);
}

export default function NBack2({ content, onStore, onProgress }) {
  const { trials, stimuli, nback } = content;
  const [stream] = useState(() => buildStream(trials, stimuli));

  const sameAsNBack = (trial) => stream[trial - 1]?.name === stream[trial - (nback + 1)]?.name;

  return (
    <SingleResponseTask
      content={content}
      onStore={onStore}
      onProgress={onProgress}
      stream={stream}
      scoreResponse={(stim, trial) => (trial > nback ? sameAsNBack(trial) : false)}
      scoreTimeout={(stim, trial) => (trial > nback ? !sameAsNBack(trial) : true)}
      canRespond={(trial) => trial > nback}
      blockedMessage="nback.invalid.selection.notification"
      startTextDefault="nback.are_you_ready"
      fixationClass="stimulus-fixation"
    />
  );
}
