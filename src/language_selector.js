import React from 'react';

import {useParams, Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

import {ltrTheme, ltrCache} from './utils/theme';

import {
  Grid,
  Paper,
  Button,
  ThemeProvider,
  CssBaseline,
  Container,
} from '@mui/material';
import { CacheProvider } from '@emotion/react';

import Markdown from 'react-markdown/with-html';

import {languages} from './utils/i18n';

import './index.css'

export default function LanguageSelector(props) {

  const { t } = useTranslation();
  let {studyId} = useParams();


  return (
    <CacheProvider value={ltrCache}>
      <ThemeProvider theme={ltrTheme}>
        <CssBaseline />

        <Container maxWidth="sm" className='study-container'>
          <Grid item container
            spacing={2}
            direction="column"
            justifyContent="flex-start"
            alignItems="stretch"
          >
            <Paper className='languages-container'>

            <Markdown source={t('language_selector.text')} escapeHtml={false}  className='markdown-text' />
            <Grid container direction='row' spacing={3} justifyContent='space-around'>
            {Object.entries(languages).map(([key, val]) => 
              <Grid item key={key} xs={4}>
                <Button component={Link} to={`/${studyId}/${key}`} fullWidth variant='outlined'>{val.title}</Button>
              </Grid>
            )}
            </Grid>
            </Paper>
          </Grid>
        </Container>
      </ThemeProvider>
    </CacheProvider>
  );
}
