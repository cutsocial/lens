import React, { Fragment } from 'react';

import {useParams, Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

import theme from './utils/theme';

import {Grid, Paper, Button, ThemeProvider, CssBaseline, Container} from '@material-ui/core';

import Markdown from 'react-markdown/with-html';

import {languages} from './utils/i18n';

import './index.css'

export default function LanguageSelector(props) {

  const {t, i18n} = useTranslation();
  let {studyId} = useParams();


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Container maxWidth="sm" className='study-container'>
        <Grid item container
          spacing={2}
          direction="column"
          justify="flex-start"
          alignItems="stretch"
        >
          <Paper className='languages-container'>

          <Markdown source={t('language_selector.text')} escapeHtml={false}  className='markdown-text' />
          <Grid container direction='row' spacing={3} justify='space-around'>
          {Object.entries(languages).map(([key, val]) => 
            <Grid item key={key} xs={4}>
              <Button component={Link} to={`/${studyId}/${key}`} fullWidth variant='outlined'>{val}</Button>
            </Grid>
          )}
          </Grid>
          </Paper>
        </Grid>
      </Container>
    </ThemeProvider>
  );
}
