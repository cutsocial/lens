import './polyfills';
import React, {Suspense} from 'react';
import { createRoot } from 'react-dom/client';
import i18n from './utils/i18n';
import AppRouter from './router';
import {I18nextProvider} from 'react-i18next';
import ReactGA from 'react-ga4';

//css
import './index.css';

// Initialize google analytics
ReactGA.initialize('G-YFD0H08757');

// No <React.StrictMode>: in development it runs effect cleanups twice, and survey
// views save their responses in a cleanup, which would store duplicates while testing.
createRoot(document.getElementById('root')).render(
  <Suspense fallback="loading">
  <I18nextProvider i18n={i18n}>
    <AppRouter />
  </I18nextProvider>
  </Suspense>
);
