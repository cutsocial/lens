import React, {useRef, useState, useEffect} from 'react';

import {useParams,useLocation} from 'react-router-dom';

import {
  Container,
  ThemeProvider,
  CssBaseline,
  LinearProgress,
  Grid,
  Paper,
  Snackbar,
} from '@mui/material';
import { Alert } from '@mui/material';
import { CacheProvider } from '@emotion/react';

import {ltrTheme, rtlTheme, ltrCache, rtlCache} from './utils/theme';
import {languages} from './utils/i18n';

import Navigation from './navigation';
import Text from './text';
import Prolific from './prolific'
import Matrix from './matrix';
import Submission from './submission';
import Stroop2 from './v2/stroop2';
import GoNoGoAlt2 from './v2/gonogoalt2';
import NBack2 from './v2/nback2';
import Bart2 from './v2/bart2';

// Lens 2 view types draw their own surfaces, so the study page doesn't wrap them in a card.
const LENS2_TYPES = ['stroop2', 'gonogoalt2', 'nback2', 'bart2'];
import BART from './bart';
import GoNoGo from './gonogo';
import Stroop from './stroop';
import Ultimatum from './ultimatum';
import Dictator from './dictator';
import { useTranslation } from 'react-i18next';
import TaskSwitch from './taskswitch';
import SimplifiedTaskSwitch from './simplified_taskswitch';
import NBack from './nback';
import GoNoGoAlt from './gonogoalt';
import ReactGA from "react-ga4";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Study(props) {

  ReactGA.initialize("G-YFD0H08757");
  const {t, i18n} = useTranslation();
  let {lang, studyId} = useParams();

  // prolific shits
  let query = useQuery();

  const isRtl = languages[lang].direction === 'rtl';
  const theme = isRtl?rtlTheme:ltrTheme;
  const responseIsValid = useRef(false);

  const [state, setState] = useState({
    subject: undefined,
    session: undefined,
    progress: 0,
    finished: false,
    loading: false,
    view: {},
    currentViewIndex: 0,
    responses: [],
    experiment: {}
  })

  const [notification, setNotification] = useState(undefined);

  const storeData = (data, autoNext=false) => {
    console.log('study.storeData', data);

    if (autoNext) {
      onNext();
    }
    
    setState(prev => {
      return {
        ...prev,
        responses: [...prev.responses, data],
        loading: false
      }
    });
  }

  const updateViewProgress = (currentViewProgressPct) => {

    const currentViewProgress = currentViewProgressPct  / 100.0

    setState(prev => {
      return {
        ...prev,
        progress: 100 * (prev.currentViewIndex + currentViewProgress) / 
                  prev.experiment.views.length
                  
      }
    });
  }

  const onNext = () => {

    if ((state.view.required || state.view.requiredQuestions?.length>0) && !responseIsValid.current) {
      setNotification(t('errors.required'))
      return;
    }

    responseIsValid.current = false;

    setState(prev => {
      const nextViewIndex = prev.currentViewIndex + 1;

      if (nextViewIndex < prev.experiment.views.length) {  
        return {
          ...prev,
          loading: true,
          progress: 100 * nextViewIndex / prev.experiment.views.length,
          view: prev.experiment.views[nextViewIndex],
          currentViewIndex: nextViewIndex
        }
      } else { //finished
        return {
          ...prev,
          progress: 100,
          finished: true,
          loading: false
        }
      }
    })

  }
  
  const renderView = (view) => {
    
    if (state.finished) {
      return (
        <Submission submission={{
          PROLIFIC_PID: query.get('PROLIFIC_PID'),
          STUDY_ID: query.get('STUDY_ID'),
          SESSION_ID: query.get('SESSION_ID'),
          startedAt: state.startedAt,
          responses: state.responses}}
          studyId={studyId} submissionNote={state.experiment.submissionNote} />
      );
    }

    switch(view?.type) {
      case 'text':
        return <Text onStore={storeData} content={view} key={view.id} onValidate={(r) => responseIsValid.current = r} />;
      case 'prolific':
        return <Prolific onStore={storeData} content={view} key={view.id} onValidate={(r) => responseIsValid.current = r} />;
      case 'bart':
        return <BART onStore={storeData} content={view} key={view.id} />;
      case 'gonogo': 
        return <GoNoGo onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} />;
      case 'stroop': 
        return <Stroop onStore={storeData} content={view} key={view.id} />;
      case 'stroop2':
        return <Stroop2 onStore={storeData} content={view} key={view.id} />;
      case 'gonogoalt2':
        return <GoNoGoAlt2 onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} />;
      case 'nback2':
        return <NBack2 onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} />;
      case 'bart2':
        return <Bart2 onStore={storeData} content={view} key={view.id} />;
      case 'matrix':
        return <Matrix onStore={storeData} content={view} key={view.id} onValidate={(r) => responseIsValid.current = r} />
      case 'ultimatum':
        return <Ultimatum onStore={storeData} content={view} key={view.id} onNotification={setNotification} />;
      case 'dictator':
        return <Dictator onStore={storeData} content={view} key={view.id} onNotification={setNotification} />;
      case 'taskswitch':
        return <TaskSwitch onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} onNotification={setNotification} />;
      case 'simplified_taskswitch':
        return <SimplifiedTaskSwitch onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} onNotification={setNotification} />;
      case 'nback':
        return <NBack onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} onNotification={setNotification} />;
      case 'gonogoalt':
        return <GoNoGoAlt onStore={storeData} onProgress={updateViewProgress} content={view} key={view.id} onNotification={setNotification} />;
      default:
        return <div>Not Implemented!</div>;
    }

  }
  
  const startExperiment = (experiment) => {
    console.log("starting experiment", experiment);
    console.log("prolific pid : ",query.get('PROLIFIC_PID'))
    setState(prev => {
      return {
        ...prev,
        startedAt: Date.now(),
        experiment: experiment,
        currentViewIndex: 0,
        view: experiment.views[0]
      }
    });

    if (process.env.NODE_ENV === 'production') {
      ReactGA.send({ hitType: "pageview", page: window.location.pathname , title: "window?.title" });
    }

  }

  // Optional study-level text size, e.g. "fontScale": 1.2 in the study JSON.
  // Applied only on survey views; reset on interactive tasks so stimulus sizes
  // stay exactly as designed. All MUI text is sized in rem, so the root font
  // size scales it in one place.
  const fontScale = Number(state.experiment && state.experiment.fontScale) || 1;
  const isSurveyView = ['text', 'matrix', 'prolific'].includes(state.view && state.view.type);
  useEffect(() => {
    document.documentElement.style.fontSize = (isSurveyView && fontScale !== 1) ? `${fontScale * 100}%` : '';
    return () => { document.documentElement.style.fontSize = ''; };
  }, [isSurveyView, fontScale]);

  //load experiment
  useEffect(() => {
    i18n.changeLanguage(lang);
    fetch(process.env.PUBLIC_URL + `/experiments/${studyId}.json`)
      .then(resp => resp.json())
      .then(experiment => startExperiment(experiment));
  },[studyId]);

  //render
  return (
    <CacheProvider value={isRtl?rtlCache:ltrCache}>
      <ThemeProvider theme={theme}>
        <div dir={languages[lang].direction}>
          <CssBaseline />

          <LinearProgress variant="determinate" value={state.progress} />

          <Container maxWidth="sm" className='study-container'>
            <Grid container
              spacing={2}
              direction="column"
              justifyContent="flex-start"
              alignItems="stretch"
              className='study-grid-container'
            >
              <Snackbar 
                open={notification !== undefined} 
                autoHideDuration={5000} 
                onClose={() => setNotification(undefined)}
              >
                <Alert onClose={() => setNotification(undefined)} severity="error">{t(notification)}</Alert>
              </Snackbar>

              <Grid item>
                {LENS2_TYPES.includes(state.view.type) && !state.finished && !state.loading
                  ? renderView(state.view)
                  : <Paper className='view-container'>
                    {!state.finished && state.loading && <div>{t('loading')}</div>}
                    {!state.loading && renderView(state.view)}
                    </Paper>}
              </Grid>
              {!['gonogo','bart','stroop','ultimatum','dictator','taskswitch','simplified_taskswitch','nback','gonogoalt', ...LENS2_TYPES].includes(state.view.type) && !state.loading &&
              <Grid item>
                <Navigation onNext={onNext} finished={state.finished} redirectTo={state.experiment.redirectTo} />
              </Grid>
              }
            </Grid>
          </Container>
        </div>
      </ThemeProvider>
    </CacheProvider>
  );
}
