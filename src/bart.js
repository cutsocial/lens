import React, {useState, useEffect, Fragment, useRef} from 'react';

import {Button, Fab, Grid, Typography, Divider, Tooltip} from '@mui/material';

import {Dialog, DialogActions, DialogTitle, DialogContentText, DialogContent} from '@mui/material';

import { useTranslation } from 'react-i18next';

import './bart.css';

export default function BART({content, onStore}) {
  
  const { t } = useTranslation();
  const {reward, maxPumps, safePumps, trials} = content;

  const [state, setState] = useState({
    pumps: 0,
    finished: false,
    trial: 1,
    totalScore: 0,
    trialResponses: [],
    dialogIsOpen: false,
    taskStartedAt: Date.now(),
    showTooltip: true
  });

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // on mount and unmount
  useEffect(() => {

    // create a list of random numbers and shuffle it
    state.randomNumbers = shuffle(Array.from({length: maxPumps}, (_, i) => i+1));

    document.body.style['touch-action'] = "none";
    document.documentElement.style['touch-action'] = "none";
    return () => {
      document.body.style['touch-action'] = null;
      document.documentElement.style['touch-action'] = null;  
    }
  },[]);
  
  // when finished, store responses and proceed to the next view
  useEffect(() => {
    if (state.finished && !state.dialogIsOpen) {
      const now = Date.now()
      // add timestamps
      let response = {trials: state.trialResponses};
      response.taskStartedAt = state.taskStartedAt;
      response.taskFinishedAt = now;
      response.taskDuration = now - state.taskStartedAt;
      onStore({
        'view': content,
        'response': response
      }, true); // store + next
    }
  }, [state]);

  /**
   * Store trial responses, then proceed to the next trial or finish the game
   * @param {*} cashed either cashed or exploded
   * @param {*} explosionProbability last probability of balloon getting exploded
   */
  const newTrial = (cashed, randomNumber) => {
    setState({
      ...state, 
      dialogIsOpen: true,
      trialResponses: [...state.trialResponses, {
        trial: state.trial,
        pumps: state.pumps,
        score: cashed? state.pumps * reward : 0,
        result: cashed? "cashed" : "exploded"
      }],
      showTooltip: true,
      finished: (state.trial>=trials),
      pumps: 0,
      trial: state.trial+1,
      totalScore: state.totalScore + (cashed?state.pumps*reward:0),
      randomNumbers: shuffle(Array.from({length: maxPumps}, (_, i) => i+1))
    });
  }

  /**
   * action to inflate the baloon
   */
  const onInflate = () => {

    const isSafe = safePumps>0 && state.pumps<safePumps
    let randomIndex = Math.floor(Math.random() * state.randomNumbers.length);
    let randomNumber = state.randomNumbers.splice(randomIndex, isSafe?0:1);  
    console.log('random number: ', randomNumber[0], '(must be 1 to explode)')

    // if the randomly picked number is 1, then explode
    if (randomNumber[0] === 1) {
      newTrial(false, randomNumber);
    } else {
        setState({
        ...state,
        showTooltip: false,
        pumps: state.pumps+1
      });
    }

  };

  /**
   * action to cash in the reward
   */
  const onCashIn = () => {
    newTrial(true);
  };
  
  /**
   * render a dialog that shows trial summary.
   */
  const renderDialog = () => {
    return (
      <Dialog
        open={state.dialogIsOpen}
        onClose={(event, reason) => { if (reason !== 'backdropClick') setState({...state, dialogIsOpen: false}); }}
        disableEscapeKeyDown
        aria-labelledby="dialog-title">
          <DialogTitle id="dialog-title"><b>{state.trialResponses[state.trialResponses.length - 1].result==='cashed'?t('bart.cashed_title'):t('bart.exploded_title')}</b></DialogTitle>
          <DialogContent>
            <DialogContentText>
            {t('bart.trial_score_report', {score: state.trialResponses[state.trialResponses.length - 1].score})}
            {t('bart.total_score_report', {score: state.trialResponses.map(r => r.score).reduce((a,b) => a+b, 0)})}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setState({...state, dialogIsOpen: false})} color="primary" autoFocus size='large'>
              {state.trial<=trials?t('bart.next_trial'):t('next')}
            </Button>
          </DialogActions>
        </Dialog>
    );
  }

  const balloonSize = (pumps, maxPumps) => {
    //TODO let volume = 20/(1+Math.pow(Math.E, -3*(pumps/maxPumps))) // logit(3*pumps/maxPumps)
    //TODO calc radius
    let rad = Math.sqrt((pumps+1)*500/Math.PI)
    console.log(rad)
    return Math.ceil(2*rad)
  }

  /**
   * Render BART component (main render)
   */
  //const render = () => {
    return (
      <Fragment>
        {state.dialogIsOpen && renderDialog()}
  
        <Grid container direction='column' spacing={2} justifyContent="space-between" alignItems='stretch' className='bart-container'>
  
        <Grid item container direction='row' justifyContent="space-around" alignItems='center'>
  
          {state.trial<=trials && 
            <Grid item><Grid container direction='column' justifyContent="space-around" alignItems='center'>
              {t('bart.next_reward')}<Typography variant="h4">{state.pumps * reward}</Typography>
            </Grid></Grid>
          }
  
          {state.trial<=trials && 
            <Grid item><Grid container direction='column' justifyContent="space-around" alignItems='center'>
                <Typography color='textSecondary' variant='caption'>{t('bart.trial_label',{trial:state.trial, trials:trials})}</Typography>
            </Grid></Grid>
          }
  
            <Grid item><Grid container direction='column' justifyContent="space-around" alignItems='center'>
              {t('bart.total_points')}<Typography variant="h4">{state.totalScore}</Typography>
            </Grid></Grid>
        </Grid>
  
        {/*<Grid item><Divider /></Grid>*/}
        
        <Grid item container direction="column" alignContent='center' alignItems='center'> 
          <Tooltip title={t('bart.balloon_tooltip')} arrow open={!state.dialogIsOpen && state.showTooltip}>
          <div className="bubble-container" style={{
            cursor: 'pointer',
            width: balloonSize(state.pumps, maxPumps),
            height: balloonSize(state.pumps, maxPumps),
            transition: (state.pumps===0)?'':'width 1s, height 1s' //explosition and pumping effects
          }}
          onClick={onInflate}
          >
            <figure className="bubble"></figure>
          </div>
          </Tooltip>
        </Grid>
  
        <Grid item container direction="row" justifyContent="space-around" alignItems='center'>
          <Button size='large' color='primary' variant='outlined' onClick={onCashIn}>{t('bart.cash')}</Button>
        </Grid>

  
        </Grid>
      </Fragment>
    );
  //} //.render()

}
