import React, {useState, useEffect, useCallback, Fragment, useRef} from 'react';


import { Button, Grid, Typography, Divider, Box} from '@material-ui/core';

import { 
  Star, 
  RadioButtonUnchecked as Circle,
  CheckBoxOutlineBlank as Rectangle,
  ChangeHistory as Triangle,
  PanTool as Hand,
  SportsSoccer as Ball,
  Watch,
  School,
  FreeBreakfast as Cup,
  Add,
  Block,
  Check as Correct,
  Clear as Incorrect
} from '@material-ui/icons';

import Markdown from 'react-markdown/with-html';

import { sample, shuffle } from './utils/random';
import { useTranslation } from 'react-i18next';
import { useStimulusOnset, responseTiming, timeoutTiming } from './utils/timing';

import './gonogoalt.css';

//FIXME these are realtime variables, so I keep them out of the component's state.
let clock

export default function GoNoGoAlt({content, onStore, onProgress, onNotification}) {

  const { t } = useTranslation();
  const { text, trials, stimuliDuration, fixationDuration, feedbackDuration, choices } = content;
  const _noresponse = 'noresponse';

  const iconFigures = {
    star: Star,
    circle: Circle,
    triangle: Triangle,
    rectangle: Rectangle,
    hand: Hand,
    ball: Ball,
    watch: Watch,
    school: School,
    cup: Cup
  }

  const [state, setState] = useState({
    finished: false,
    trial: null,
    step: null,
    trialResponses: [],
    taskStartedAt: null,
    taskFinishedAt: null,
    taskDuration: null,
    trialStartedAt: null,
    respondedAt: null,
    stimuli: null,
    correct: null
  })

  const stimulusOnset = useStimulusOnset(state.step === 'stimuli', state.trial);

  useEffect(() => {
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
      if (state.step !== 'stimuli' || !(keyCode === 32 || key === ' '))
        return;

      const current = state.stimuli[state.trial - 1];
      handleResponse(current, event);
    }
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };

  },[state]);


  useEffect(() => {

    // generate stimuli stream
    if (state.stimuli===null) {
      console.log(trials);
      let stim = [...Array(trials.total).keys()].map((i,t) => {
        if (i<trials.go)
          return {"trialType": "go", "type": choices.go.type, "name":sample(choices.go.names)}
        else
          return {"trialType": "nogo", "type": choices.nogo.type, "name":sample(choices.nogo.names)}
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

    // # STIMULI
    if (state.step === 'stimuli') {
      clearTimeout(clock);
      clock = setTimeout(() => {
        const respondedAt = Date.now(); //timestamp
        console.log('stimuli step timeout. stimuli: %o', state.stimuli[state.trial-1]);
        const _correct =  state.stimuli[state.trial-1]?.trialType?.endsWith('nogo');
        setState({
          ...state,
          correct: _correct,
          respondedAt: respondedAt,
          trialResponses: [...state.trialResponses, {
            'trial': state.trial,
            'stimuli': state.stimuli[state.trial-1],
            'choice': _noresponse,
            'correct': _correct,
            'respondedAt': respondedAt,
            'trialStartedAt': state.trialStartedAt,
            'rt': null,
            ...timeoutTiming(stimulusOnset)
          }],
          step: (feedbackDuration>0)?'feedback':'fixation'
        });
      }, stimuliDuration)
    }

    // Set progress
    onProgress(100.0 * state.trial / trials.total)
  
    // check if task is finished
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
      step: 'fixation', 
      taskStartedAt: Date.now()
    })
    console.log('task started. stimuli: %o', state.stimuli)
  }

  /**
   * handles user response
   * @param {*} selected 
   */
  const handleResponse = (selected, event) => {
    const respondedAt = Date.now(); //timestamp
    clearTimeout(clock);

    const _correct = !state.stimuli[state.trial-1]?.trialType?.endsWith('nogo')

    setState({
      ...state,
      correct: _correct,
      respondedAt: respondedAt,
      trialResponses: [...state.trialResponses, {
        'trial': state.trial,
        'stimuli': state.stimuli[state.trial-1],
        'choice': selected,
        'correct': _correct,
        'respondedAt': respondedAt,
        'trialStartedAt': state.trialStartedAt,
        'rt': respondedAt - state.trialStartedAt,
        ...responseTiming(event, stimulusOnset)
      }],
      step: (feedbackDuration>0)?'feedback':'fixation'
    })
  }

  /**
   * Renders the given stimulus. If type is icon it uses iconFigures to render, and if type is letter it uses Typography element
   * @param {*} stimulus 
   * @returns html element of the stimuli
   */
  const renderStimulus = (stimulus) => {
    console.log('renderStimulus: ',stimulus);
    if(stimulus===null || stimulus===undefined){
      console.log('figure is null, state:',state);
      return(
        <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        </Grid>
      )
    }
    if(stimulus.type==="icon"){
      if(!iconFigures[stimulus.name]){
        return(
          <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
            <Fragment>
              <Box onClick={(e) => handleResponse(stimulus, e)} className='single-stimulus single-stimulus-icon'>
                <Block fontSize='large' className='yellow single-stimulus-icon' />
              </Box>
            </Fragment>
          </Grid>
        );
      }
      const FigureCompoentnt = iconFigures[stimulus.name];
      return(
        <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
          <Box onClick={(e) => handleResponse(stimulus, e)} className='single-stimulus single-stimulus-icon'>
            <FigureCompoentnt fontSize='large' className='yellow single-stimulus-icon' />
          </Box>
        </Grid>
      );
    }else if(stimulus.type==="letter"){
      return(
        <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
          <Box onClick={(e) => handleResponse(stimulus, e)} className='single-stimulus single-stimulus-letter' textAlign="center">
            <Typography type='span' className='yellow single-stimuli-letter'> {stimulus.name} </Typography>
          </Box>
        </Grid>
      );
    }
  }

  /**
   * Renders feedback
   */
  const renderFeedback = () => {
    return (
      <Grid item container direction='row' justifyContent='space-around' alignItems='center'>
        {state.correct && <Correct fontSize='large' className='correct single-stimulus-icon' />}
        {!state.correct && <Incorrect fontSize='large' className='incorrect single-stimulus-icon' />}
      </Grid>
    )
  }

  /**
   * Renders fixation element
   */
  const renderFixation = () => {
    return (
      <Grid item container direction="row" justifyContent="space-around" alignItems="center">
        <Add fontSize='large' className='single-stimulus-fixation single-stimulus-icon' />
      </Grid>
    );
  }

  // start screen
  if (state.trial === null) {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('gonogoalt.are_you_ready')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' onClick={() => startTask()}>{t('gonogoalt.start')}</Button>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid item container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='gonogoalt-container'>
      <Grid item>
        <Markdown source={t(text)} escapeHtml={false} className='markdown-text' />
      </Grid>
      <Grid item container direction='row' justifyContent='center' alignItems='center' className='nback-main-container'>
        {state.step === 'stimuli'  && renderStimulus(state.stimuli[state.trial-1])}
        {state.step === 'feedback' && renderFeedback()}
        {state.step === 'fixation' && renderFixation()}
      </Grid>
    </Grid>
  );

}
