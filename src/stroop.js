import React, {useState, useEffect, useRef} from 'react';


import { Box, Button, Grid, Typography, Divider} from '@material-ui/core';

import { 
  Add,
  Check as CorrectIcon,
  Clear as IncorrectIcon,
} from '@material-ui/icons';

import shuffle from './utils/shuffle';

import Image from 'material-ui-image';

import Markdown from 'react-markdown/with-html';

import {useTranslation} from 'react-i18next';
import { useStimulusOnset, responseTiming, timeoutTiming } from './utils/timing';

import './stroop.css';

//FIXME keep this var as a ref
let clock

export default function Stroop({content, onStore}) {

  const {rule, colors, words, trials, randomizeTrials, randomizeChoices, stimulusDuration, fixationDuration, timeoutsBeforeReset, feedbackDuration} = content;


  const {t} = useTranslation();
  const separator = ''; // character that separates word and color in trials[i].stimulus and trials[i].choices

  const [state, setState] = useState({
    trialResponses: [],
    finished: false,
    trial: null,
    step: null,
    correct: null,
    timeouts: 0,
    stimuli: null
  });

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

    // ignore invalid key press at invalid stage of the trial
    if (state.step !== 'stimulus' || !['ArrowLeft', 'ArrowRight'].includes(key))
      return;

    let choices = state.stimuli[state.trial-1].choices
    let stimulus = state.stimuli[state.trial-1].stimulus

    let choice = (key==='ArrowLeft')?choices[0]:choices[1]

    handleResponse(choice, stimulus, event)
    
  }

  const stimulusOnset = useStimulusOnset(state.step === 'stimulus', state.trial);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);


  const randomize = (trials/*use props instead of: , randomizeTrials, randomizeChoices*/) => {
    let _trials = (randomizeTrials || false)?shuffle(trials):trials
    if (randomizeChoices)
      _trials = _trials.map(t=> {
        let _t = Object.assign({},t); // copy
        _t.choices = shuffle(t.choices);
        return _t;
      })
    return _trials
  }

  // when finished, store responses and proceed to the next view
  useEffect(() => {

    if (state.stimuli===null) {
      setState({
        ...state,
        stimuli: randomize(trials, randomizeTrials, randomizeChoices)
      })
    }

    if (state.step==='fixation') {
      clearTimeout(clock);  
      clock = setTimeout(() => {
        setState({
          ...state,
          step: 'stimulus',
          trial: state.trial+1, 
          trialStartedAt: Date.now()
        });
      }, fixationDuration);
    }

    if (state.step === 'feedback') {
      clearTimeout(clock);
      clock = setTimeout(() => {
        setState({...state, step: 'fixation'})
      }, feedbackDuration)
    }

    if (state.step === 'stimulus') {
      clearTimeout(clock);

      if (state.timeouts<timeoutsBeforeReset) {
        clock = setTimeout(() => {
          setState({
            ...state,
            step: (feedbackDuration>0)?'feedback':'fixation',
            trialResponses: [...state.trialResponses, {
              trial: state.trial,
              stimulus: state.stimuli[state.trial-1].stimulus,
              choice: null,
              correct: null,
              respondedAt: null,
              trialStartedAt: state.trialStartedAt,
              rt: null,
              ...timeoutTiming(stimulusOnset)}
            ],
            timeouts: state.timeouts + 1,
            correct: false
          });
        }, stimulusDuration);
      } else {
        setState({...state, step: 'reset', timeouts: 0})
      }
    }

    if (state.trial>trials.length) {
      setState({...state, finished: true, taskFinishedAt: Date.now()})
    }

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

  }, [state]);

  const startTask = () => {
    setState({
      ...state,
      trial: 0,
      timeouts: 0,
      trialResponses: [],
      step:'fixation', 
      taskStartedAt: Date.now() //timestamp
    });
  }

  const handleResponse = (choice, stimulus, event) => {
    let respondedAt = Date.now(); //timestamp

    clearTimeout(clock);

    let [choiceWord, choiceColor] = choice.split('')
    let [stimulusWord, stimulusColor] = stimulus.split('')
    let correct = (choiceWord === stimulusColor)

    //DEBUG console.log(choiceColor, stimulusWord, correct)

    setState({
      ...state,
      step: (feedbackDuration>0)?'feedback':'fixation',
      correct: correct,
      trialResponses: [...state.trialResponses,{
        trial: state.trial,
        stimulus: state.stimuli[state.trial-1].stimulus,
        choice: choice,
        correct: correct,
        respondedAt: respondedAt,
        trialStartedAt: state.trialStartedAt,
        rt: respondedAt - state.trialStartedAt,
        ...responseTiming(event, stimulusOnset)
      }]
    })
  }

  const renderStimulus = (stimulus) => {
    let [word, color] = stimulus.split('')
    return (
      <Grid container item direction='column' alignItems='center' justify='flex-start'>
      <Typography className='stroop-stimulus' variant='h1' style={{color: colors[color]}}>
        {t(words[word])}
      </Typography>
      </Grid>

    );
  }

  const renderChoices = (choices, stimulus) => {
    
    return (
      <Grid container direction='row' justify='space-between' spacing={2} alignItems='stretch' className='stroop-choices'>
      {choices.map((choice,i) => {
        let [word, color] = choice.split('')
        return (
          <Grid item xs key={i}>
          <Button style={{color: colors[color]}} onClick={(e) => handleResponse(choice, stimulus, e)} size="large" fullWidth variant='outlined'>
            {t(words[word])}
          </Button>
          </Grid>
        );
      })}
      </Grid>
    )
  }

  const renderFeedback = () => {
    return (
      <Grid item container direction='row' justify='space-around' alignItems='center'>
        {state.correct && <CorrectIcon fontSize='large' className='correct gng-icon' />}
        {!state.correct && <IncorrectIcon fontSize='large' className='incorrect gng-icon' />}
      </Grid>
    )

  }

  const renderStartScreen = () => {
    return (
      <Grid container direction='column' spacing={2} alignItems='center'>
        <Grid item><Markdown source={t('stroop.are_you_ready')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' onClick={() => startTask()}>{t('stroop.start')}</Button>
        </Grid>

      </Grid>
    )
  }

  const renderResetScreen = () => {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justify='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('stroop.too_many_timeouts')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' color='secondary' onClick={() => startTask()}>{t('stroop.restart')}</Button>
        </Grid>
      </Grid>
    )
  }

  // show reset screen on timeouts reaching a threshold
  if (state.step === 'reset') {
    return renderResetScreen();
  }

  if (state.trial === null) {
    return renderStartScreen();
  }

  
  //const render = () => {
    return (
        <Grid item container direction='column' spacing={2} alignItems='stretch' justify='flex-start' className='stroop-container stroop-board'>
          <Grid item>
            <Markdown source={t(rule)} escapeHtml={false} className='markdown-text' />
          </Grid>

          {state.trial<=trials.length && 
            state.step === 'stimulus' && 
            renderStimulus(state.stimuli[state.trial-1].stimulus) }
            
          {state.trial<=trials.length && 
            state.step === 'stimulus' && 
            renderChoices(state.stimuli[state.trial-1].choices, state.stimuli[state.trial-1].stimulus) }

          {state.step === 'feedback' && renderFeedback(state.correct)}

          {state.step === 'fixation' && 
            <Grid item container direction="row" justify="space-around" alignItems="center">
              <Add fontSize='large' className='fixation gng-icon' />
            </Grid>
          }

        </Grid>

    );
  //} //.render()

}
