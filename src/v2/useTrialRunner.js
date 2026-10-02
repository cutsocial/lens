/**
 * useTrialRunner: the shared trial engine for Lens 2 reaction-time tasks.
 *
 * One state machine for every task:
 *   start -> fixation -> stimulus -> (feedback) -> fixation -> ... -> done
 *                                  \-> reset (too many timeouts) -> start again
 *
 * It reproduces the classic Lens tasks' semantics on purpose, so data stay
 * comparable:
 *  - timeouts are counted over the whole run (not consecutively); once
 *    `timeoutsBeforeReset` is reached, the next trial shows the reset notice
 *    and starting again clears the run's responses (trial order is kept)
 *  - feedback is shown only when feedbackDuration > 0
 *  - after the last trial, one more fixation interval passes before the task
 *    finishes, so taskFinishedAt/taskDuration match the classic tasks
 *  - each trial record has the classic fields (trial, ...task fields,
 *    respondedAt, trialStartedAt, rt) plus the timingVersion 2 fields
 *    (stimulusOnsetPerf, responsePerf, rtPerf, responseInput)
 *
 * Differences from the classic code, none of which change recorded data:
 *  - timers belong to the component (no module-level clock shared by tasks)
 *  - only one response is accepted per trial, even for a fast double tap
 *  - the reset notice appears without first flashing the next stimulus
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useStimulusOnset, responseTiming, timeoutTiming } from '../utils/timing';

const initialState = {
  phase: 'start',
  trial: null,
  timeouts: 0,
  responses: [],
  correct: null,
  taskStartedAt: null,
  trialStartedAt: null,
  taskFinishedAt: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return { ...state, phase: 'fixation', trial: 0, timeouts: 0, responses: [], correct: null, taskStartedAt: action.now };
    case 'fixationDone': {
      const next = state.trial + 1;
      if (next > action.total) return { ...state, phase: 'done', trial: next, taskFinishedAt: action.now };
      if (state.timeouts >= action.timeoutsBeforeReset) return { ...state, phase: 'reset', trial: next, timeouts: 0 };
      return { ...state, phase: 'stimulus', trial: next, trialStartedAt: action.now };
    }
    case 'record':
      if (state.phase !== 'stimulus' || action.trial !== state.trial) return state;
      return {
        ...state,
        phase: action.feedback ? 'feedback' : 'fixation',
        correct: action.correct,
        timeouts: state.timeouts + (action.timedOut ? 1 : 0),
        responses: [...state.responses, action.record],
      };
    case 'feedbackDone':
      return { ...state, phase: 'fixation' };
    default:
      return state;
  }
}

/**
 * @param {object} opts
 * @param {Array}  opts.trials            trial specs in presentation order
 * @param {number} opts.fixationDuration  ms
 * @param {number} opts.stimulusDuration  ms before a trial times out
 * @param {number} opts.feedbackDuration  ms; 0 skips feedback
 * @param {number} opts.timeoutsBeforeReset  defaults to no reset
 * @param {(spec) => object} opts.timeoutFields  task fields for a timed-out trial
 * @param {(key, spec) => object|null} opts.keyResponse  task fields for a key, or null to ignore it
 * @param {(response) => void} opts.onFinish  receives the finished response object
 */
export default function useTrialRunner({
  trials,
  fixationDuration,
  stimulusDuration,
  feedbackDuration,
  timeoutsBeforeReset,
  timeoutFields,
  keyResponse,
  onFinish,
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const total = trials.length;
  const resetAfter = (typeof timeoutsBeforeReset === 'number') ? timeoutsBeforeReset : Infinity;
  const withFeedback = feedbackDuration > 0;

  const stimulusOnset = useStimulusOnset(state.phase === 'stimulus', state.trial);

  // Latest values for timers and event handlers.
  const latest = useRef();
  latest.current = { state, trials, timeoutFields, keyResponse, onFinish };
  const answered = useRef(null); // trial number already answered

  const spec = (state.trial >= 1 && state.trial <= total) ? trials[state.trial - 1] : null;

  const start = useCallback(() => {
    answered.current = null;
    dispatch({ type: 'start', now: Date.now() });
  }, []);

  /** Record a response for the current trial. `fields` = task fields incl. `correct`. */
  const respond = useCallback((fields, event) => {
    const { state: s } = latest.current;
    if (s.phase !== 'stimulus' || answered.current === s.trial) return;
    answered.current = s.trial;
    const respondedAt = Date.now();
    const record = {
      trial: s.trial,
      ...fields,
      respondedAt,
      trialStartedAt: s.trialStartedAt,
      rt: respondedAt - s.trialStartedAt,
      ...responseTiming(event, stimulusOnset),
    };
    dispatch({ type: 'record', trial: s.trial, record, correct: fields.correct, feedback: withFeedback, timedOut: false });
  }, [stimulusOnset, withFeedback]);

  // Phase timers
  useEffect(() => {
    let id;
    if (state.phase === 'fixation') {
      id = setTimeout(() => dispatch({ type: 'fixationDone', now: Date.now(), total, timeoutsBeforeReset: resetAfter }), fixationDuration);
    } else if (state.phase === 'stimulus') {
      const trial = state.trial;
      id = setTimeout(() => {
        const { state: s, trials: ts, timeoutFields: tf } = latest.current;
        if (answered.current === trial) return;
        answered.current = trial;
        const record = {
          trial,
          ...tf(ts[trial - 1]),
          respondedAt: null,
          trialStartedAt: s.trialStartedAt,
          rt: null,
          ...timeoutTiming(stimulusOnset),
        };
        // Classic tasks show "incorrect" feedback after a timeout.
        dispatch({ type: 'record', trial, record, correct: false, feedback: withFeedback, timedOut: true });
      }, stimulusDuration);
    } else if (state.phase === 'feedback') {
      id = setTimeout(() => dispatch({ type: 'feedbackDone' }), feedbackDuration);
    }
    return () => clearTimeout(id);
  }, [state.phase, state.trial]); // eslint-disable-line react-hooks/exhaustive-deps

  // Finish once
  const finished = useRef(false);
  useEffect(() => {
    if (state.phase !== 'done' || finished.current) return;
    finished.current = true;
    latest.current.onFinish({
      trials: state.responses,
      taskStartedAt: state.taskStartedAt,
      taskFinishedAt: state.taskFinishedAt,
      taskDuration: state.taskFinishedAt - state.taskStartedAt,
      timingVersion: 2,
    });
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Space starts; during a stimulus the task maps keys to responses.
  useEffect(() => {
    const onKeyDown = (event) => {
      const { state: s, trials: ts, keyResponse: kr } = latest.current;
      if (s.phase === 'start' && (event.key === ' ' || event.keyCode === 32)) {
        event.preventDefault();
        start();
        return;
      }
      if (s.phase !== 'stimulus' || !kr) return;
      const fields = kr(event.key, ts[s.trial - 1]);
      if (fields) {
        event.preventDefault();
        respond(fields, event);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [respond, start]);

  return {
    phase: state.phase,
    trial: state.trial,
    total,
    spec,
    correct: state.correct,
    start,
    respond,
  };
}
