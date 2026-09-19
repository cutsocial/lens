// Replacement for src/submission.js in cutsocial/lens.
// - retries with backoff if the save fails (2s, 4s, 8s, 16s)
// - sends a submissionId so retries are never double-counted
// - still shows the completion note if every attempt fails, so participants aren't stuck
// - no participant data or Prolific IDs go to Google Analytics
import React, { useEffect, useRef, useState } from 'react';

import {Grid} from '@material-ui/core';
import Markdown from 'react-markdown/with-html';
import {useTranslation} from 'react-i18next';
import ReactGA from "react-ga4";

const API = 'https://server.cut.social/api/v1';
const MAX_ATTEMPTS = 5;

const newSubmissionId = () =>
  (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function Submission({submission, studyId, submissionNote}) {

  const {t} = useTranslation();
  const [status, setStatus] = useState('sending'); // sending | saved | failed
  const [submissionCode, setSubmissionCode] = useState(undefined);
  const started = useRef(false);
  const debug = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (started.current) return;   // submit exactly once
    started.current = true;

    const submissionId = newSubmissionId();
    const payload = JSON.stringify({...submission, submissionId});

    const send = async (attempt) => {
      try {
        const resp = await fetch(`${API}/${studyId}/responses`, {
          method: 'POST',
          mode: 'cors',
          body: payload,
          headers: {'Content-Type': 'application/json'}
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        setSubmissionCode(json.submissionCode);
        setStatus('saved');
      } catch (error) {
        ReactGA.event({
          category: 'error',
          action: 'submission_failed',
          label: `${studyId} attempt ${attempt}: ${error.message}`
        });
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => send(attempt + 1), 1000 * 2 ** attempt);
        } else {
          setSubmissionCode(submissionId.slice(0, 8).toUpperCase());
          setStatus('failed');
        }
      }
    };

    send(1);
  }, []);

  return (
    <Grid container direction='column' className='Text-container'>

      {status === 'sending' &&
      <Grid item xs>{t('submitting', 'Saving your responses, please keep this page open…')}</Grid>
      }

      {status !== 'sending' &&
      <Grid item xs className="submission-container">
        <Markdown source={t(submissionNote, {submissionCode})} escapeHtml={false} className='markdown-text' />
      </Grid>
      }

      {debug &&
      <Grid item xs>
        <pre>{JSON.stringify(submission, null, 2)}</pre>
      </Grid>
      }

    </Grid>
  );
}
