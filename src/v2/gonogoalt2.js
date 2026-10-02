/**
 * Go/No-Go with letters or icons, Lens 2 ("type": "gonogoalt2").
 * Same study-file options, stimulus stream and data fields as classic
 * "gonogoalt" (src/gonogoalt.js); the response adds taskVersion: 2.
 *
 * Classic rules kept exactly:
 *  - stream: trials.go go-stimuli then the rest no-go, each name sampled from
 *    its list, then the whole stream shuffled
 *  - responding (Space or tap) is correct on go trials
 *  - withholding until the stimulus times out is correct on no-go trials, and
 *    the timeout record is stamped with respondedAt, as classic does
 */
import React, { useState } from 'react';
import { sample, shuffle } from '../utils/random';
import SingleResponseTask from './singleResponseTask';

const isNoGo = (stim) => Boolean(stim && stim.trialType && stim.trialType.endsWith('nogo'));

export default function GoNoGoAlt2({ content, onStore, onProgress }) {
  const { trials, choices } = content;
  const [stream] = useState(() => shuffle(
    [...Array(trials.total).keys()].map((i) => (i < trials.go
      ? { trialType: 'go', type: choices.go.type, name: sample(choices.go.names) }
      : { trialType: 'nogo', type: choices.nogo.type, name: sample(choices.nogo.names) }))
  ));

  return (
    <SingleResponseTask
      content={content}
      onStore={onStore}
      onProgress={onProgress}
      stream={stream}
      scoreResponse={(stim) => !isNoGo(stim)}
      scoreTimeout={(stim) => isNoGo(stim)}
      startTextDefault="gonogoalt.are_you_ready"
      fixationClass="single-stimulus-fixation"
    />
  );
}
