import React, { Suspense, lazy, useEffect } from 'react';
import ReactGA from 'react-ga4';

import {
  HashRouter as Router,
  Switch,
  Route,
} from "react-router-dom";

//main components
import Study from './study';
import About from './about';
import LanguageSelector from './language_selector';
import PreviewHost from './builder/previewHost';

// The builder is a researcher tool: loaded only when opened, so participants never download it.
const Builder = lazy(() => import('./builder/builder'));

export default function AppRouter() {
  useEffect(() => {
    // Send pageview with a custom path
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, [window.location.pathname]);

  return (
    <Router basename="/">
        <Switch>
          <Route exact path="/"><About /></Route>
          <Route exact path="/builder"><Suspense fallback={null}><Builder /></Suspense></Route>
          <Route path="/__preview/:lang"><PreviewHost /></Route>
          <Route path="/:studyId/:lang"><Study /></Route>
          <Route path="/:studyId"><LanguageSelector /></Route>
          <Route path="/about"><About /></Route>
        </Switch>
    </Router>
  );
}
