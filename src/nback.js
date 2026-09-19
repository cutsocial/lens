import React, { useEffect, useState, Fragment } from 'react';
import { Box, Button, Grid, Typography } from '@material-ui/core';
import { useTranslation } from 'react-i18next';
import { useStimulusOnset, responseTiming, timeoutTiming } from './utils/timing';
import Markdown from 'react-markdown/with-html';
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
  Block,
  Check as Correct,
  Clear as Incorrect,
  Add
} from '@material-ui/icons';
import { shuffle } from './utils/random';

//css
import "./nback.css";

//FIXME these are realtime variables, so I keep them out of the component's state.
let clock

export default function NBack({content, onStore, onNotification, onProgress}) {
  //props: title, text  
  
  const { t } = useTranslation();
  
  const { text, trials, stimuliDuration, fixationDuration, feedbackDuration, nback, stimuli } = content;
  
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
  };

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
    stimuli: null
  });

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
    // console.log("use effect for generating stimuli: ", state.stimuli);
    // generate stimuli stream
    if (state.stimuli===null) {
      let figureIndex = 0;
      let figureTotal =0;
      let stim = [...Array(trials).keys()].map((i,t) => {
        let figure = stimuli[figureIndex];
        if(figureTotal<figure.amount){
          figureTotal++;
          return {"type": figure.type, "name": figure.name};
        }else{
          figureIndex++;
          figureTotal = 1;
          if(figureIndex>=stimuli.length){
            console.log('error in figure numbers and total trials, reseting figures. Index: %d , length: %d', figureIndex, stimuli?.length);
            figureIndex = 0;
          }
          figure = stimuli[figureIndex];
          return {"type": figure.type, "name": figure.name};
        }
      });
      setState({...state, stimuli: shuffle(stim)});
    }

    // check if it is finished
    if (state.trial > trials) {
      console.log('------------ FINISHED -------')
      onProgress(100.0)
      setState({ ...state, finished: true, taskFinishedAt: Date.now() })
    }

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

    // # STIMULI
    if (state.step === 'stimuli') {
      clearTimeout(clock); 
      clock = setTimeout(() => {
        const respondedAt = Date.now(); //timestamp
        //console.log("trial: %d  - stimulus: %o",state.trial,state.stimuli[state.trial-1]);
        const _correct = state.trial>nback ? state.stimuli[state.trial - 1]?.name!==state.stimuli[state.trial - (nback+1)]?.name : true ;
        setState({
          ...state,
          correct: _correct,
          respondedAt: respondedAt,
          trialResponses: [...state.trialResponses, {
            'trial': state.trial,
            'stimuli': state.stimuli[state.trial - 1],
            'choice': _noresponse,
            'correct': _correct,
            'respondedAt': respondedAt,
            'trialStartedAt': state.trialStartedAt,
            'rt': null,
            ...timeoutTiming(stimulusOnset)
          }],
          step: (feedbackDuration > 0) ? 'feedback' : 'fixation'
        });
      }, stimuliDuration)
    }

    // Set progress
    onProgress(100.0 * state.trial / trials)

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

  }, [state] );

  /**
   * Starts the task
   */
  const startTask = () => {
    setState({
      ...state,
      trialResponses: [],
      trial: 0,
      step: 'fixation',
      taskStartedAt: Date.now()
    })
    console.log('task started. stimuli: %o', state.stimuli);
  }

  /**
   * handles user response
   * @param {*} selected 
   */
  const handleResponse = (selected, event) => {
    if(state.trial<=nback){
      return onNotification(t('nback.invalid.selection.notification'));
    }

    const respondedAt = Date.now(); //timestamp
    clearTimeout(clock);

    //console.log("trial: %d  - stimulus: %o  -  selected: %o",state.trial,state.stimuli[state.trial-1],selected);
    //if(state.trial>nback)
    // console.log("stimulus1 : %o  -  stimulus2 : %o  -  comp result: %s",state.stimuli[state.trial - 1],state.stimuli[state.trial - (nback+1)],state.stimuli[state.trial - 1].name!==state.stimuli[state.trial - (nback+1)].name);

    const _correct = state.trial>nback ? state.stimuli[state.trial - 1]?.name===state.stimuli[state.trial - (nback+1)]?.name : false ;

    setState({
      ...state,
      correct: _correct,
      respondedAt: respondedAt,
      trialResponses: [...state.trialResponses, {
        'trial': state.trial,
        'stimuli': state.stimuli[state.trial - 1],
        'choice': selected,
        'correct': _correct,
        'respondedAt': respondedAt,
        'trialStartedAt': state.trialStartedAt,
        'rt': respondedAt - state.trialStartedAt,
        ...responseTiming(event, stimulusOnset)
      }],
      step: (feedbackDuration > 0) ? 'feedback' : 'fixation'
    });
    //console.log('handle resp: %o , after setState', selected);
  }

  /**
   * Renders the given stimulus, if type is icon it uses iconFigures to render, and if type is letter it uses Typography element
   * @param {*} stimulus 
   * @returns html element of the stimuli
   */
  const renderStimulus = (stimulus) => {
    console.log('renderFigure: ',stimulus);
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
        <Add fontSize='large' className='stimulus-fixation single-stimulus-icon' />
      </Grid>
    );
  }

  // start screen
  if (state.trial === null) {
    return (
      <Grid container direction='column' spacing={2} alignItems='center' justifyContent='flex-start' className='Text-container'>
        <Grid item><Markdown source={t('nback.are_you_ready')} escapeHtml={false} className='markdown-text' /></Grid>
        <Grid item>
          <Button variant='outlined' onClick={() => startTask()}>{t('nback.start')}</Button>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='nback-container'>
      <Grid item>
        <Markdown source={t(text)} escapeHtml={false} className='markdown-text' />
      </Grid>
      <Grid item container direction='row' justifyContent='center' alignItems='center' className='nback-main-container'>
        {state.step === 'stimuli'  && renderStimulus(state.stimuli[state.trial-1])}
        {state.step === 'feedback' && state.trial>nback && renderFeedback()}
        {state.step === 'fixation' && renderFixation()}
      </Grid>
    </Grid>
  );
}
