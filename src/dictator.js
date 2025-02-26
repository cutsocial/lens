import React, { useEffect, useState, Fragment, useCallback } from 'react';
import { Typography, Button, Grid, Dialog, DialogTitle, DialogContent,
          DialogContentText, DialogActions,
          Container,
          CircularProgress,
          Box} from '@material-ui/core';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { useTranslation } from 'react-i18next';
import { shuffle } from './utils/random';
import { ItemTypes, RepositoryBox } from './components/allotmentBox';

//css
import "./dictator.css";

export default function Dictator({ content, onStore, onNotification }) {

  const { t } = useTranslation();
  const { tokens, trials, useOpponentTypes, opponentTypes, text, personsPrefix, persons } = content;

  //const theme = (languages[lang].direction === 'rtl') ? rtlTheme : ltrTheme;
  //const classes = useStyles(theme);

  const [state, setState] = useState({
    finished: false,
    trial: null,
    totalScore: 0,
    dialogIsOpen: false,
    trialResponses: [],
    taskStartedAt: Date.now(),
    collectionState: 0 // 0: not started, 1: started, 2: done
  });
  const [boxes, setBoxes] = useState(
    [
      { name: ItemTypes.OPPONENT, amount: 0, accepts: [ItemTypes.POT, ItemTypes.PLAYER] },
      { name: ItemTypes.POT, amount: tokens, accepts: [ItemTypes.PLAYER, ItemTypes.OPPONENT] },
      { name: ItemTypes.PLAYER, amount: 0, accepts: [ItemTypes.POT, ItemTypes.OPPONENT] },
    ]
  )
  const [shuffledPersons, setShuffledPersons] = useState(undefined);

  // on mount and unmount
  useEffect(() => {
    // Nothing yet
  }, []);

  // when finished, store responses and proceed to the next view
  useEffect(() => {
    if (state.finished && !state.dialogIsOpen) {
      const now = Date.now()
      // add timestamps
      let response = { trials: state.trialResponses };
      response.taskStartedAt = state.taskStartedAt;
      response.taskFinishedAt = now;
      response.taskDuration = now - state.taskStartedAt;
      onStore({
        'view': content,
        'response': response
      }, true); // store + next
    }
  }, [state, onStore, content]);

 /**
   * Filters persons to return only the persons that have any of the given tags
   * @param {*persons} persons persons to be filtered by their tags
   * @param {*} tags tags used to select the persons which their tags has at least one the tags given
   * @returns
   */
  const filterPersonsByTags = (persons, tags) => {
    if (useOpponentTypes !== true)
      return persons;
    const filterredPersons = persons.filter(person => { return checkPersonHasTags(person, tags) });
      return filterredPersons;
  }

  /**
   * Checks if the given person has any of the the given tags
   * @returns true if the person has any of the given tags
   */
  function checkPersonHasTags(person, tags) {
    var checkResult = false;
    for (let i = 0; i < person.tags.length; i++) {
      if (tags.inclue(person.tags[i]))
        checkResult = true;
    }
    return checkResult;
  }

  const finishTrialAction = () => {
    canFinishTrial() ? newTrial() : onNotification(t('dictator.errors.required'));
  }

  /***
   * this function shows if this trial can be finished by the participant
   */
  const canFinishTrial = () => {
    let result = false;
    boxes.forEach((box) => {
      if (box.name === ItemTypes.POT && box.amount === 0)
        result = true;
    });
    return result;
  }

  /***
   * Activated when player has droped a token (item that is dragged and name of the dropped box) by setting setBoxes
   */
  const handleDrop = useCallback(
    (name, item) => {
      // item is the entity that is dropped and has {name, boxName}
      // name is the name of the repositoryBox that entity has been dropped into
      const fromBox = item.boxName;
      const destBox = name;
      //console.log('dropped on: ',destBox);
      //console.log('from : ',fromBox);
      setBoxes(boxes.map(item => {
        if (item.name === fromBox) {
          return { ...item, amount: item.amount - 1 };
        } else if (item.name === destBox) {
          return { ...item, amount: item.amount + 1 };
        } else {
          return item;
        }
      }));
    },
    [boxes],
  )

  /***
   * Starts the task for the first time
   */
  const startTask = () => {
    let filterredPersons = filterPersonsByTags(persons, opponentTypes);
    setShuffledPersons(shuffle(filterredPersons));
    setState({
      ...state,
      trial: 0,
      trialResponses: [],
      taskStartedAt: Date.now() //timestamp
    });
  }

  /**
   * Store trial responses, then proceed to the next trial or finish the game
   */
  const newTrial = () => {
    if (!canFinishTrial()) {
      console.log('it should never come to this, because before calling newTrial, canFinishTrial has been checked!!!!');
      onNotification(t('dictator.errors.required'));
      return;
    }
    const playerShare = boxes.find(box => box.name === ItemTypes.PLAYER).amount;
    setState({
      ...state,
      trialResponses: [...state.trialResponses, {
        trial: state.trial,
        playerShare: playerShare,
        opponentShare: tokens - playerShare,
        opponent: shuffledPersons[personIndex]
      }],
      finished: (state.trial >= trials - 1),
      trial: state.trial + 1,
      totalScore: state.totalScore + playerShare,
      dialogIsOpen: true,
    });

    // when the trial finished the tokens in boxes should reset
    setBoxes(
      [
        { name: ItemTypes.OPPONENT, amount: 0, accepts: [ItemTypes.POT, ItemTypes.PLAYER] },
        { name: ItemTypes.POT, amount: tokens, accepts: [ItemTypes.PLAYER, ItemTypes.OPPONENT] },
        { name: ItemTypes.PLAYER, amount: 0, accepts: [ItemTypes.POT, ItemTypes.OPPONENT] },
      ]
    );
  }

  if (state.trial === null) {
    console.log('dictator starting...');
    startTask();
    return;
  }

  // If persons are less than the number of trials it should fill the array
  var personIndex = state.trial;
  if (state.trial !== null && state.trial >= shuffledPersons.length) {
    personIndex = state.trial % shuffledPersons.length;
  }

  /**
   * render a dialog that shows trial summary.
   */
  const renderDialog = () => {
    return (
      <Dialog
        open={state.dialogIsOpen}
        onClose={() => setState({ ...state, dialogIsOpen: false })}
        disableEscapeKeyDown
        aria-labelledby="dialog-title"
        className='margined-dialog'
        id='collect-dialog'
      >
        <DialogTitle id="dialog-title"><b>{t('dictator.dialog_title')}</b></DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('dictator.trial_score_report', { score: state.trialResponses[state.trialResponses.length - 1].playerShare })}
            {t('dictator.total_score_report', { score: state.trialResponses.map(r => r.playerShare).reduce((a, b) => a + b, 0) })}
            <Container id="matchmaking-loading" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px' // Gives some vertical space for centering
            }}>
              <Box id="matchmaking-loading">
                {/* Spinner and stating we are waiting for other person's action */}
                <CircularProgress />
                <Box mt={2}>
                  <Typography variant='body2'>{t('dictator.waiting_for_opponent')}</Typography>
                </Box>
              </Box>
              <Box id="matchmaking-result" className='hide'>
                <Typography variant='body2'>{t('dictator.matchmaking_result')}</Typography>
              </Box>
            </Container>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setState({ ...state, dialogIsOpen: false })} color="primary" autoFocus size='large'>
            {state.trial <= trials - 1 ? t('dictator.next_trial') : t('next')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const isTouchScreen = () => {
    return ( 'ontouchstart' in window ) ||
           ( navigator.maxTouchPoints > 0 ) ||
           ( navigator.msMaxTouchPoints > 0 );
  }
  const dndBackend = isTouchScreen() ? TouchBackend : HTML5Backend;

  /***
   * Main render part of the dictator experiment
   *
   */
  return (
    <Fragment>
      {state.dialogIsOpen && renderDialog() }
      <Grid container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start'>
        <Grid item>
          <Typography variant="body2">{t(text)}</Typography>
        </Grid>
        {/* Boxes container */}
        <Grid item container spacing={2} alignItems='stretch' justifyContent='space-between' className='boxes-container'>
          <DndProvider backend={dndBackend} options={isTouchScreen()?{enableMouseEvents: true}:{}}>
            {boxes.map(({name, amount, accepts}, index) => (
              <RepositoryBox
                accept={accepts}
                name={name}
                amount={amount}
                onDrop={(item) => handleDrop(name, item)}
                key={index}
                person={shuffledPersons[personIndex]}
                personsPrefix={personsPrefix}
              />
            ))}
          </DndProvider>
        </Grid>
        {/* Labels and actions */}
        <Grid item container direction='row' justifyContent="space-around" alignItems='center'>
          <Grid item xs={4}><Grid container direction='column' justifyContent="space-around" alignItems='center'>
            <Typography variant='body2'>{t('dictator.trial_label',{trial:state.trial+1, trials:trials})}</Typography>
          </Grid></Grid>

          <Grid item xs={4}><Grid container direction='column' justifyContent="space-around" alignItems='center'>
            <Button size='large' color='primary' variant='outlined' onClick={finishTrialAction}>{t('dictator.finish.button')}</Button>
          </Grid></Grid>

          <Grid item xs={4}><Grid container direction='column' justifyContent="space-around" alignItems='center'>
            <Typography variant="body2">{t('dictator.total_points',{score:state.totalScore})}</Typography>
          </Grid></Grid>
        </Grid>
      </Grid>
    </Fragment>
  );
}