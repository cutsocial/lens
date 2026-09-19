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

import './gonogo.css';

//FIXME these are realtime variables, so I keep them out of the component's state.
let clock

export default function GoNoGo({content, onStore, onProgress}) {

  const {t} = useTranslation();
  const {text, trials, stimuliDuration, fixationDuration, choices, timeoutsBeforeReset, feedbackDuration} = content;

  const [state, setState] = useState({
    finished: false,
    trialResponses: [],
    taskStartedAt: null,
    taskFinishedAt: null,
    taskDuration: null,
    step: null,
    correct: null,
    stimuli: null,
    trialStartedAt: null,
    respondedAt: null,
    trial: null,
    timeouts: 0
  })

  /**
   * callback to handle keypress events
   */
  const handleKeyPress = (event) => {
    const { key, keyCode } = event;

    // press space to start the task
    if (state.trial === null && (keyCode===32 || key===' ')) {
      startTask()
      return;
    }

    // ignore invalid keys and invalid trial steps
    if (state.step !== 'stimuli' || !['ArrowLeft', 'ArrowRight'].includes(key))
      return;

    const current = state.stimuli[state.trial-1];
    let choice = undefined;

    let empty = (key==='ArrowLeft' && current.startsWith('right')) || 
                (key==='ArrowRight' && current.startsWith('left'))
    let go = (key==='ArrowLeft' && current==='left-go') ||
             (key==='ArrowRight' && current==='right-go') 

    choice = go?choices.go:(empty?'empty':choices.nogo)

    handleResponse(choice, event)
    
  }

  const stimulusOnset = useStimulusOnset(state.step === 'stimuli', state.trial);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);


  useEffect(() => {

    // generate stimuli stream
    if (state.stimuli===null) {
      let stim = [...Array(trials.total).keys()].map((i,t) => {
        if (i<trials.leftGo)
          return 'left-go'
        if (i<trials.go)
          return 'right-go'
        if (i<trials.go + (trials.left - trials.leftGo))
          return 'left-nogo'
        return 'right-nogo'
      }) 
      setState({...state, stimuli: shuffle(stim)});
    }


    // # FIXATION
    if (state.step === 'fixation') {
      clearTimeout(clock);  
      clock = setTimeout(() => {
          setState({
            ...state, 
            trial: state.trial+1, 
            trialStartedAt: Date.now(), 
            step: 'stimuli'
          });
        }, fixationDuration);
    }

    // # FEEDBACK
    if (state.step === 'feedback') {
      clearTimeout(clock);
      clock = setTimeout(() => {
          setState({...state, step: 'fixation'})
        }, feedbackDuration)
    }

    if (state.step === 'stimuli') {
      clearTimeout(clock);

      if (state.timeouts<timeoutsBeforeReset) {
        clock = setTimeout(() => {
          setState({...state,
            trialResponses: [...state.trialResponses, {
              'trial': state.trial,
              'stimuli': state.stimuli[state.trial-1],
              'choice': null,
              'correct': null,
              'respondedAt': null,
              'trialStartedAt': state.trialStartedAt,
              'rt': null,
              ...timeoutTiming(stimulusOnset)
            }],
            timeouts: state.timeouts + 1,
            correct: false,
            step: (feedbackDuration>0)?'feedback':'fixation'
          });
        }, stimuliDuration)
      } else {
        setState({...state, step: 'reset', timeouts: 0})
      }
    }


    onProgress(100.0 * state.trial / trials.total)
  
    if (state.trial>trials.total) {
      console.log('------------ FINISHED -------')
      onProgress(100.0)
      setState({...state, finished: true, taskFinishedAt: Date.now()})
    }

    // on finish
    if (state.finished) {
      clearTimeout(clock);
      
      // timestamps
      let response = {trials: state.trialResponses};
      response.taskStartedAt = state.taskStartedAt;
      response.taskFinishedAt = state.taskFinishedAt;
      response.taskDuration = state.taskFinishedAt - state.taskStartedAt;
      response.timingVersion = 2;
      onStore({
        'view': content,
        'response': response
      }, true); // store + next
    }

  },[state]);

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

    const _correct = (choice===choices.go && !state.stimuli[state.trial-1].endsWith('nogo')) || 
              (choice==='empty' && state.stimuli[state.trial-1].endsWith('nogo'))

    setState({
      ...state,
      correct: _correct,
      respondedAt: respondedAt,
      trialResponses: [...state.trialResponses, {
        'trial': state.trial,
        'stimuli': state.stimuli[state.trial-1],
        'choice': choice,
        'correct': _correct,
        'respondedAt': respondedAt,
        'trialStartedAt': state.trialStartedAt,
        'rt': respondedAt - state.trialStartedAt,
        ...responseTiming(event, stimulusOnset)
      }],
      step: (feedbackDuration>0)?'feedback':'fixation'
    })
  }

  const renderStimulus = (stimulus) => {
    return (
      <Fragment>
      {stimulus==='star' && <div onClick={(e) => handleResponse('star', e)} className='gng-stimulus'><Star fontSize='large' className='yellow' /></div>}
      {stimulus==='empty' && <div onClick={(e) => handleResponse('empty', e)} className='gng-stimulus'> </div>}
      {stimulus==='circle' && <div onClick={(e) => handleResponse('circle', e)} className='gng-stimulus'><Circle fontSize='large' className='blue' /></div>}
      {stimulus==='blue-star' && <div onClick={(e) => handleResponse('blue-star', e)} className='gng-stimulus'><Star fontSize='large' className='blue' /></div>}
      {stimulus==='yellow-circle' && <div onClick={(e) => handleResponse('yellow-circle', e)} className='gng-stimulus'><Star fontSize='large' className='yellow' /></div>}
      </Fragment>
    );
  }

  const renderStimuli = (trialType) => {
    return (
      <Grid item container direction="row" justifyContent="space-around" alignItems="center">
        {trialType === 'left-go' && renderStimulus(choices.go)}
        {trialType === 'left-nogo' && renderStimulus(choices.nogo)}
        {(trialType !== 'left-go' && trialType !== 'left-nogo') && renderStimulus('empty')}
        <Divider orientation="vertical" flexItem />
        {trialType === 'right-go' && renderStimulus(choices.go)}
        {trialType === 'right-nogo' && renderStimulus(choices.nogo)}
        {(trialType !== 'right-go' && trialType !== 'right-nogo') && renderStimulus('empty')}
      </Grid>
    )
  }

  const renderFeedback = () => {
    return (
      <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        {state.correct && <Correct fontSize='large' className='correct gng-icon' />}
        {!state.correct && <Incorrect fontSize='large' className='incorrect gng-icon' />}
      </Grid>
    )

  }

  const renderFixation = () => {
    return (
      <Grid item container direction="row" justifyContent="space-around" alignItems="center">
        <Add fontSize='large' className='fixation gng-icon' />
      </Grid>
    );
  }

  // show reset screen on timeouts reaching a threshold
  if (state.step === 'reset') {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('gonogo.too_many_timeouts')} escapeHtml={false}  className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' color='secondary' onClick={() => startTask()}>{t('gonogo.restart')}</Button>
        </Grid>
      </Grid>

    )
  }

  // start screen
  if (state.trial === null) {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('gonogo.are_you_ready')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' onClick={() => startTask()}>{t('gonogo.start')}</Button>
        </Grid>

      </Grid>

    )
  }

  //const render = () => {
    return (
        <Grid item container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='gonogo-container'>
          <Grid item>
            <Markdown source={t(text)} escapeHtml={false} className='markdown-text' />
          </Grid>

          {state.step === 'stimuli'  && renderStimuli(state.stimuli[state.trial-1])}
          {state.step === 'feedback' && renderFeedback()}
          {state.step === 'fixation' && renderFixation()}

        </Grid>

    );
  //} //.render()

}
