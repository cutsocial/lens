import React, { useEffect } from 'react';
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

export default function AppRouter() {
  useEffect(() => {
    // Send pageview with a custom path
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  }, [window.location.pathname]);

  return (
    <Router basename="/">
        <Switch>
          <Route exact path="/"><About /></Route>
          <Route path="/:studyId/:lang"><Study /></Route>
          <Route path="/:studyId"><LanguageSelector /></Route>
          <Route path="/about"><About /></Route>
        </Switch>
    </Router>
  );
}
