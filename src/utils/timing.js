import { useLayoutEffect, useRef } from 'react';

/**
 * High-resolution timing fields (timingVersion 2), saved alongside the legacy
 * Date.now()-based trialStartedAt / respondedAt / rt. All *Perf values are in
 * the performance.now() timebase (ms since page time origin).
 */

/**
 * Returns a ref holding performance.now() taken in the first
 * requestAnimationFrame after the stimulus for `trial` was committed to the
 * DOM. The ref is null until that frame runs, and again once `active` ends.
 *
 * @param {boolean} active true while the stimulus is on screen
 * @param {number} trial   current trial index, so back-to-back stimuli re-arm
 */
export function useStimulusOnset(active, trial) {
  const onset = useRef(null);

  useLayoutEffect(() => {
    onset.current = null;
    if (!active) return undefined;

    const id = window.requestAnimationFrame(() => {
      onset.current = performance.now();
    });
    return () => window.cancelAnimationFrame(id);
  }, [active, trial]);

  return onset;
}

// React synthetic events wrap the native one, which carries the real timestamp
const nativeEvent = (event) => (event && event.nativeEvent) || event;

// event.timeStamp is on the performance.now() timebase in current browsers;
// some older ones report epoch milliseconds, so convert those.
const eventTime = (event) => {
  const ts = nativeEvent(event)?.timeStamp;
  if (typeof ts !== 'number') return null;
  if (ts > 1e12) {
    const origin = performance.timeOrigin || (Date.now() - performance.now());
    return ts - origin;
  }
  return ts;
};

/**
 * Timing fields for a trial answered by a keydown or click.
 * @param {Event} event the keydown/click that triggered the response
 * @param {{current: number|null}} onset ref from useStimulusOnset
 */
export function responseTiming(event, onset) {
  const responsePerf = eventTime(event);
  const stimulusOnsetPerf = onset.current;
  const type = nativeEvent(event)?.type;

  return {
    stimulusOnsetPerf,
    responsePerf,
    rtPerf: (responsePerf !== null && stimulusOnsetPerf !== null)
      ? responsePerf - stimulusOnsetPerf
      : null,
    responseInput: type === 'keydown' ? 'key' : (type === 'click' ? 'click' : null)
  };
}

/**
 * Timing fields for a trial that ended because the stimulus duration elapsed.
 * @param {{current: number|null}} onset ref from useStimulusOnset
 */
export function timeoutTiming(onset) {
  return {
    stimulusOnsetPerf: onset.current,
    responsePerf: null,
    rtPerf: null,
    responseInput: 'timeout'
  };
}
