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

import './taskswitch.css';

//FIXME these are realtime variables, so I keep them out of the component's state.
let clock

export default function TaskSwitch({ content, onStore, onProgress }) {

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

      let empty = (key==='ArrowLeft' && current.startsWith('right')) || 
                  (key==='ArrowRight' && current.startsWith('left'));
      let go = (key==='ArrowLeft' && current.startsWith('left-go')) ||
              (key==='ArrowRight' && current.startsWith('right-go'));

      choice = current.endsWith('top') ? 
          (go?trials.top.choices.go : (empty?'empty':trials.top.choices.nogo) )
          :
          (go?trials.bottom.choices.go : (empty?'empty':trials.bottom.choices.nogo)) ;
      handleResponse(choice, event)
    }
    
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };

  }, [state] // FIXME add missin dependencies
  );

  useEffect(() => {
    // generate stimuli stream
    if (state.stimuli===null) {
      let stim = [...Array(trials.total).keys()].map((i,t) => {
        if(i<trials.top.total){
          if(i<trials.top.leftGo)
            return 'left-go-top'
          if (i<trials.top.go)
            return 'right-go-top'
          if (i<trials.top.go + (trials.top.left - trials.top.leftGo))
            return 'left-nogo-top'
          return 'right-nogo-top'
        }else{
          if(i<trials.top.total+trials.bottom.leftGo)
            return 'left-go-bottom'
          if(i<trials.top.total+trials.bottom.go)
            return 'right-go-bottom'
          if (i<trials.top.total+ trials.bottom.go + (trials.bottom.left - trials.bottom.leftGo))
            return 'left-nogo-bottom'
          return 'right-nogo-bottom'
        }
      }); 
      setState({...state, stimuli: shuffle(stim)});
    }
  }, [state]);

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

    const _correct = getCorrect(state.stimuli[state.trial - 1]);
    console.log('correct answer = %s for choice %s , in stimuli %o', _correct, choice, state.stimuli[state.trial - 1]);

    setState({
      ...state,
      correct: _correct === choice,
      respondedAt: respondedAt,
      trialResponses: [...state.trialResponses, {
        'trial': state.trial,
        'stimuli': state.stimuli[state.trial - 1],
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

  function getCorrect(stimuli){
    const choices = stimuli.endsWith('top') ? trials.top.choices : trials.bottom.choices;
    return stimuli.includes('nogo') ? 'empty' : choices.go;
  }

  const renderStimulus = (stimulus, selectable = true) => {
    return (
      <Fragment>
      {stimulus==='empty' && selectable && <div onClick={(e) => handleResponse('empty', e)} className='ts-stimulus'> </div>}
      {stimulus==='empty' && !selectable && <div className='ts-stimulus ts-inactive'> </div>}
      {stimulus==='star' && <div onClick={(e) => handleResponse('star', e)} className='ts-stimulus'><Star fontSize='large' className='yellow' /></div>}
      {stimulus==='circle' && <div onClick={(e) => handleResponse('circle', e)} className='ts-stimulus'><Circle fontSize='large' className='blue' /></div>}
      {stimulus==='blue-star' && <div onClick={(e) => handleResponse('blue-star', e)} className='ts-stimulus'><Star fontSize='large' className='blue' /></div>}
      {stimulus==='yellow-circle' && <div onClick={(e) => handleResponse('yellow-circle', e)} className='ts-stimulus'><Star fontSize='large' className='yellow' /></div>}
      </Fragment>
    );
  }

  /**
   * 
   * @param {*} trialType type of trial
   * @param {*} pos 0 for top, 1 for bottom
   * @returns renders a row of stimuli
   */
  const renderStimuliRow = (trialType, pos) =>{
    const choices = trialType.endsWith('top') ? trials.top.choices : trials.bottom.choices;
    return (
      <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        {pos===0 && trialType.endsWith('bottom') && renderStimulus('empty',false)}
        {pos===0 && trialType.endsWith('top') && trialType.startsWith('left-go') && renderStimulus(choices.go)}
        {pos===0 && trialType.endsWith('top') && trialType.startsWith('left-nogo') && renderStimulus(choices.nogo)}
        {pos===0 && trialType.endsWith('top') && (!trialType.includes('left-go')  && !trialType.includes('left-nogo')) && renderStimulus('empty')}
        {pos===1 && trialType.endsWith('top') && renderStimulus('empty',false)}
        {pos===1 && trialType.endsWith('bottom') && trialType.startsWith('left-go') && renderStimulus(choices.go)}
        {pos===1 && trialType.endsWith('bottom') && trialType.startsWith('left-nogo') && renderStimulus(choices.nogo)}
        {pos===1 && trialType.endsWith('bottom') && (!trialType.startsWith('left-go') && !trialType.startsWith('left-nogo')) && renderStimulus('empty')}
        <Divider orientation='vertical' flexItem />
        {pos===0 && trialType.endsWith('bottom') && renderStimulus('empty',false)}
        {pos===0 && trialType.endsWith('top') && trialType.startsWith('right-go') && renderStimulus(choices.go)}
        {pos===0 && trialType.endsWith('top') && trialType.startsWith('right-nogo') && renderStimulus(choices.nogo)}
        {pos===0 && trialType.endsWith('top') && (!trialType.includes('right-go')  && !trialType.includes('right-nogo')) && renderStimulus('empty')}
        {pos===1 && trialType.endsWith('top') && renderStimulus('empty',false)}
        {pos===1 && trialType.endsWith('bottom') && trialType.startsWith('right-go') && renderStimulus(choices.go)}
        {pos===1 && trialType.endsWith('bottom') && trialType.startsWith('right-nogo') && renderStimulus(choices.nogo)}
        {pos===1 && trialType.endsWith('bottom') && (!trialType.startsWith('right-go') && !trialType.startsWith('right-nogo')) && renderStimulus('empty')}
      </Grid>
    )
  }
  const renderStimuli = (trialType) => {
    //console.log("renderStimuli: ",trialType);
    if(!trialType)
      return;
    return (
      <Grid item container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='ts-stimulus-container'>
        {renderStimuliRow(trialType,0)}
        <Grid item> <Divider orientation='horizontal' /> </Grid>
        {renderStimuliRow(trialType,1)}
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
