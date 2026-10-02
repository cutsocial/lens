import React from 'react';

import {Button, Grid} from '@mui/material';

import {useTranslation} from 'react-i18next';

export default function Navigation({finished, redirectTo, onNext}) {

  const {t} = useTranslation();

  return (
    <Grid container direction='row' justifyContent='flex-end'>
      <Grid item>
        {!finished && 
          <Button variant="contained" color="primary" onClick={onNext}>{t('next')}</Button>
        }
        {finished && redirectTo &&
          <Button variant="contained" color="primary" href={redirectTo}>{t('finish_and_redirect')}</Button>        
        }
      </Grid>

    </Grid>
  );
}