// Classic final page. Sending and retries live in utils/useSubmission.js,
// shared with the Lens 2 final page (v2/submission2.js).
import React from 'react';

import {Grid} from '@mui/material';
import Markdown from 'react-markdown/with-html';
import {useTranslation} from 'react-i18next';

import useSubmission from './utils/useSubmission';

export default function Submission({submission, studyId, submissionNote}) {

  const {t} = useTranslation();
  const {status, submissionCode} = useSubmission(submission, studyId);
  const debug = process.env.NODE_ENV !== 'production';

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
