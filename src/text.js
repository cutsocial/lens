import React, { useRef, useEffect, useState, Fragment } from 'react';
import { TextField, Grid } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown/with-html';

import countries from './utils/countries';

//css
import "./text.css";

export default function Text({content, onStore, onValidate}) {
  //props: title, text, placeholder, help, required, pattern, instruction, autoComplete
  //i18n: text.choose_a_country, text.no_options

  const { t } = useTranslation();

  const response = useRef(null);
  const [state, setState] = useState({
    value: null
  });


  useEffect(() => {
    return () => {
      onStore({
        'view': content,
        'response': response.current?.code || response.current
      })
    };
  },[]);


  const handleChange = (e, value) => {
    response.current = value
    setState({...state, value: value});

    const resp = value?.code || response.current
    console.log(resp)

    onValidate(resp !== undefined && resp.length>0);
  }


  /**
   * Componenet to select a country from a dropdown list.
   * Enable this feature by adding `autoComplete:'coutries'` to the view.
   */
  const CountryAutoComplete = () => {

    // ISO 3166-1 alpha-2 (No support for IE 11)
    const countryToFlag = (isoCode) => {
      return typeof String.fromCodePoint !== 'undefined'
        ? isoCode
            .toUpperCase()
            .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
        : isoCode;
    }

    return (
      <Autocomplete
        id="country-select"
        options={countries}
        autoHighlight
        onChange={(e, v) => handleChange(e, v)}
        value={state.value}
        getOptionLabel={(option) => option.label}
        noOptionsText={t('text.no_options')}
        renderOption={(props, option) => (
          <li {...props} key={option.code}>
            <span>{countryToFlag(option.code)}</span>&nbsp;{option.label}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('text.choose_a_country')}
            variant="outlined"
            inputProps={{
              ...params.inputProps,
              autoComplete: 'new-password', // disable autocomplete and autofill
            }}
            className='country-select'
          />
        )}
      />
    );
  }


  return (
    <Grid container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='Text-container'>
      <Grid item>
        <Markdown source={t(content.text)} escapeHtml={false} className='markdown-text' />
      </Grid>

      {!(content.instruction || false) &&
        <Grid item>
          {content.autoComplete === 'countries' && <CountryAutoComplete />}
          {!content.autoComplete && <TextField label={t(content.placeholder)} variant="filled" fullWidth onChange={(e) => handleChange(e, e.target.value)} />}
        </Grid>
      }
    </Grid>
  );
}
