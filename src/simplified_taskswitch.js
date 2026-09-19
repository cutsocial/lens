import React, { useState, useEffect, Fragment } from 'react';


import { Button, Grid, Divider } from '@material-ui/core';

import {
  Star,
  RadioButtonUnchecked as Circle,
  Add,
  Check as Correct,
  Clear as Incorrect
} from '@material-ui/icons';

import Markdown from 'react-markdown/with-html';

import { shuffle } from './utils/random';
import { useTranslation } from 'react-i18next';
import { useStimulusOnset, responseTiming, timeoutTiming } from './utils/timing';

import './simplified_taskswitch.css';

//FIXME these are realtime variables, so I keep them out of the component's state.
let clock

export default function SimplifiedTaskSwitch({ content, onStore, onProgress }) {

  const { t } = useTranslation();
  const { text, trials, stimuliDuration, fixationDuration, timeoutsBeforeReset, feedbackDuration } = content;

  const [state, setState] = useState({
    finished: false,
    trialResponses: [],
    taskStartedAt: null,
    taskFinishedAt: null,
    taskDuration: null,
    step: null,
    type: null,
    correct: null,
    stimuli: null,
    trialStartedAt: null,
    respondedAt: null,
    trial: null,
    timeouts: 0
  })


  const stimulusOnset = useStimulusOnset(state.step === 'stimuli', state.trial);

  useEffect(() => {
    console.log('useEffect -> before handleKeyPress, it has no dependency');
    /**
     * callback to handle keypress events
     */
    const handleKeyPress = (event) => {
      const { key, keyCode } = event;

      // press space to start the task
      if (state.trial === null && (keyCode === 32 || key === ' ')) {
        startTask()
        return;
      }

      // ignore invalid keys and invalid trial steps
      if (state.step !== 'stimuli' || !['ArrowLeft', 'ArrowRight'].includes(key))
        return;

      const current = state.stimuli[state.trial - 1];
      let choice = undefined;

      if (key === 'ArrowLeft')
        choice = current.pos > 1 ? 2 : 0;
      if (key === 'ArrowRight')
        choice = current.pos > 1 ? 3 : 1;

      handleResponse(choice, event)

    }
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [state] // FIXME add missin dependencies
  );

  useEffect(() => {

    console.log(state.stimuli);
    // generate stimuli stream : stimuli:{pos: [0 top-left, 1 top-right, 2 bott-left, 3 bott-right]  , figure:'figureA/B' , color: 'blue/yellow }
    if (state.stimuli === null) {
      let stim = [...Array(trials.total).keys()].map((i, t) => {
        let stimuliProperties = {
          pos: 0, // 0 top-left, 1 top-right, 2 bott-left, 3 bott-right]
          figure: 0, // 0 'figureA' , 1 'figureB' color: 'blue/yellow }
          color: 0 // 0 colorA , 1 colorB
        };
        if (i < trials.typeA) {
          stimuliProperties.pos = (i < trials.left) ? 0 : 1;
          stimuliProperties.figure = i < trials.figureA ? 0 : 1;
          stimuliProperties.color = i < trials.colorA ? 0 : 1;
        } else {
          stimuliProperties.pos = (i - trials.typeA) < trials.left ? 2 : 3;
          stimuliProperties.figure = (i - trials.typeA) < trials.figureA ? 0 : 1;
          stimuliProperties.color = (i - trials.typeA) < trials.colorA ? 0 : 1;
        }
        return stimuliProperties;
      })
      setState({ ...state, stimuli: shuffle(stim) });
    }
  }, [state.stimuli]);

  useEffect(() => {
    // # FIXATION
    if (state.step === 'fixation') {
      clearTimeout(clock);
      clock = setTimeout(() => {
        setState({
          ...state,
          trial: state.trial + 1,
          trialStartedAt: Date.now(),
          step: 'stimuli'
        });
      }, fixationDuration);
    }

    // # FEEDBACK
    if (state.step === 'feedback') {
      clearTimeout(clock);
      clock = setTimeout(() => {
        setState({ ...state, step: 'fixation' })
      }, feedbackDuration)
    }

    if (state.step === 'stimuli') {
      clearTimeout(clock);

      if (state.timeouts < timeoutsBeforeReset) {
        clock = setTimeout(() => {
          setState({
            ...state,
            trialResponses: [...state.trialResponses, {
              'trial': state.trial,
              'stimuli': state.stimuli[state.trial - 1],
              'choice': null,
              'correct': null,
              'respondedAt': null,
              'trialStartedAt': state.trialStartedAt,
              'rt': null,
              ...timeoutTiming(stimulusOnset)
            }],
            timeouts: state.timeouts + 1,
            correct: false,
            step: (feedbackDuration > 0) ? 'feedback' : 'fixation'
          });
        }, stimuliDuration)
      } else {
        setState({ ...state, step: 'reset', timeouts: 0 })
      }
    }


    onProgress(100.0 * state.trial / trials.total)

    if (state.trial > trials.total) {
      console.log('------------ FINISHED -------')
      onProgress(100.0)
      setState({ ...state, finished: true, taskFinishedAt: Date.now() })
    }

    // on finish
    if (state.finished) {
      clearTimeout(clock);

      // timestamps
      let response = { trials: state.trialResponses };
      response.taskStartedAt = state.taskStartedAt;
      response.taskFinishedAt = state.taskFinishedAt;
      response.taskDuration = state.taskFinishedAt - state.taskStartedAt;
      response.timingVersion = 2;
      onStore({
        'view': content,
        'response': response
      }, true); // store + next
    }

  }, [state]);


  const startTask = () => {
    setState({
      ...state,
      trialResponses: [],
      trial: 0,
      timeouts: 0,
      step: 'fixation',
      taskStartedAt: Date.now()
    })
  }

  const handleResponse = (choice, event) => {
    const respondedAt = Date.now(); //timestamp

    clearTimeout(clock);

    const _correct = getCrorrectFromStimuli(state.stimuli[state.trial - 1]);
    console.log('correct answer = %d for choice %d , in stimuli %o', _correct, choice, state.stimuli[state.trial - 1]);

    setState({
      ...state,
      correct: _correct === choice,
      respondedAt: respondedAt,
      trialResponses: [...state.trialResponses, {
        'trial': state.trial,
        'stimuli': state.stimuli[state.trial - 1],
        'type': state.stimuli[state.trial - 1].pos < 2 ? 0 : 1,
        'choice': choice,
        'correct': _correct === choice,
        'respondedAt': respondedAt,
        'trialStartedAt': state.trialStartedAt,
        'rt': respondedAt - state.trialStartedAt,
        ...responseTiming(event, stimulusOnset)
      }],
      step: (feedbackDuration > 0) ? 'feedback' : 'fixation'
    })
  }

  function getCrorrectFromStimuli(stimuli) {
    if (stimuli.pos < 2) {
      if (stimuli.figure === 0)
        return stimuli.pos;
      return 1 - stimuli.pos;
    }
    if (stimuli.pos > 1) {
      if (stimuli.color === 0)
        return stimuli.pos;
      return stimuli.pos === 2 ? 3 : 2;
    }
  }

  const renderStimulus = (stimulus, pos) => {
    return (
      <Fragment>
        <div onClick={(e) => handleResponse(pos, e)} className='ts-stimulus'>
          {stimulus === '0-0' && <Star fontSize='large' className='yellow' />}
          {stimulus === '1-0' && <Circle fontSize='large' className='yellow' />}
          {stimulus === '0-1' && <Star fontSize='large' className='blue' />}
          {stimulus === '1-1' && <Circle fontSize='large' className='blue' />}
        </div>
      </Fragment>
    );
  }

  const renderStimuliRow = (draw, stimuli, i, j) => {
    if (draw === false)
      return (
        <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
          {renderStimulus('empty', i)}
          <Divider orientation='vertical' flexItem />
          {renderStimulus('empty', j)}
        </Grid>
      );
    return (
      <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        {stimuli?.pos === i && renderStimulus(stimuli.figure + '-' + stimuli.color, stimuli.pos)}
        {stimuli?.pos === j && renderStimulus('empty', i)}
        <Divider orientation='vertical' flexItem />
        {stimuli?.pos === i && renderStimulus('empty', j)}
        {stimuli?.pos === j && renderStimulus(stimuli.figure + '-' + stimuli.color, stimuli.pos)}
      </Grid>
    )
  }
  const renderStimuli = (stimuli) => {
    return (
      <Grid item container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='ts-stimulus-container'>
        {stimuli?.pos < 2 && renderStimuliRow(true, stimuli, 0, 1)}
        {stimuli?.pos > 1 && renderStimuliRow(false)}
        <Grid item> <Divider orientation='horizontal' /> </Grid>
        {stimuli?.pos < 2 && renderStimuliRow(false)}
        {stimuli?.pos > 1 && renderStimuliRow(true, stimuli, 2, 3)}
      </Grid>
    )
  }

  const renderFeedback = () => {
    return (
      <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        {state.correct && <Correct fontSize='large' className='correct ts-icon' />}
        {!state.correct && <Incorrect fontSize='large' className='incorrect ts-icon' />}
      </Grid>
    )

  }

  const renderFixation = () => {
    return (
      <Grid item container direction="row" justifyContent="space-around" alignItems="center">
        <Add fontSize='large' className='fixation ts-icon' />
      </Grid>
    );
  }

  // show reset screen on timeouts reaching a threshold
  if (state.step === 'reset') {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('taskswitch.too_many_timeouts')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' color='secondary' onClick={() => startTask()}>{t('taskswitch.restart')}</Button>
        </Grid>
      </Grid>

    )
  }

  // start screen
  if (state.trial === null) {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('taskswitch.are_you_ready')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' onClick={() => startTask()}>{t('taskswitch.start')}</Button>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid item container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='ts-container'>
      <Grid item>
        <Markdown source={t(text)} escapeHtml={false} className='markdown-text' />
      </Grid>

      {state.step === 'stimuli' && renderStimuli(state.stimuli[state.trial - 1])}
      {state.step === 'feedback' && renderFeedback()}
      {state.step === 'fixation' && renderFixation()}

    </Grid>
  );
}
