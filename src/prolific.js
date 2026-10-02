import React, { useRef, useEffect, useState } from 'react';
import { TextField, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown/with-html';
import { useLocation } from 'react-router-dom';

//css
import "./text.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Prolific({content, onStore, onValidate}) {
  //props: title, text, placeholder, help, required, pattern, instruction, autoComplete
  //i18n: text.choose_a_country, text.no_options

  const { t } = useTranslation();
  let query = useQuery();
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
  },[response]);


  const handleChange = (e, value) => {
    response.current = value
    setState({...state, value: value});

    const resp = value?.code || response.current
    console.log(resp)

    onValidate(resp !== undefined && resp.length>0);
  }

  var fieldContent = null;
  if(content?.getUrlContent === true){
    if(content?.paramNameAsContent !== null && content.paramNameAsContent?.length>0){
      console.log(content?.paramNameAsContent);
      fieldContent = query.get(content.paramNameAsContent);
      console.log(fieldContent);
    }
  }else if(content?.content !== null && content?.content?.length>0){
    fieldContent = content.content;
  }
  // run for the first time or s.t like that
  if(state.value==null){
    if(fieldContent!==null && fieldContent.length>0){
      setState({ value : fieldContent});
      return;
    }
  }

  return (
    <Grid container direction='column' spacing={2} alignItems='stretch' justifyContent='flex-start' className='Text-container'>
      <Grid item>
        <Markdown source={t(content.text)} escapeHtml={false} className='markdown-text' />
      </Grid>

      {!(content.instruction || false) &&
        <Grid item>
          <TextField label={t(content.placeholder)} defaultValue={fieldContent!=null ? fieldContent : undefined} variant="filled" fullWidth onChange={(e) => handleChange(e, e.target.value)} />
        </Grid>
      }
    </Grid>
  );
}
