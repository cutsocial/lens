import React, {useEffect, useRef} from 'react';

import {Grid, Radio, Tooltip, RadioGroup, FormControlLabel, Divider, Slider} from '@mui/material';

import Markdown from 'react-markdown/with-html';
import {useTranslation} from 'react-i18next';

function ValueLabelComponent(props) {
  const { children, open, value } = props;

  return (
    <Tooltip open={open} enterTouchDelay={0} placement="top" title={value} arrow>
      {children}
    </Tooltip>
  );
}

export default function Matrix({content, onStore, onValidate}) {

  const {t} = useTranslation();
  const {questions, choices, direction, text, slider, showMidMark } = content;

  const response = useRef({
    values: Array.from({ length: questions.length })
  });

  useEffect(() => {
    if (content.requiredQuestions.length>0)
      onValidate(false);
    
    window.scrollTo({top: 0, behavior: "smooth"});
    return () => {
      onStore({
        'view': content,
        'response': response.current
      })
    };
  },[]);

  const renderSlider = (choices, index) => {
    return (
      <Grid item container xs key={index} className='matrix-slider'>
        <Slider
          defaultValue={response.current.values[index]}
          value={response.current.values[index]}
          valueLabelFormat={(v) => t(choices[v-1])}
          aria-labelledby={"question"+index}
          components={{ ValueLabel: ValueLabelComponent }}
          onChangeCommitted={(e, value) => handleChange(e, index, value)}
          step={1}
          min={1}
          max={choices.length}
          valueLabelDisplay="on"
        />
        <Grid container direction='row' alignItems='stretch' justifyContent='space-between'>
          <Grid item className='mark'><em>{t(choices[0])}</em></Grid>
          {showMidMark && <Grid item className='mark'><em>{t(choices[Math.floor(choices.length/2)])}</em></Grid>}
          <Grid item className='mark'><em>{t(choices[choices.length-1])}</em></Grid>
        </Grid>

      </Grid>
    );
  }

  const renderChoice = (c, index) => {
    return (
      <Grid item xs key={index}>
        <FormControlLabel
          control={<Radio />}
          value={c}
          label={t(c)}
          labelPlacement={direction==='vertical'?'end':'bottom'}
        />
      </Grid>
    )
  }

  const handleChange = (e, index, value) => {
    // Sliders pass the numeric value; radios pass only the event. MUI v5's slider
    // event can carry the hidden input's value as a string, so the explicit value
    // must win to keep storing numbers, as v4 did.
    response.current.values[index] = (value !== undefined) ? value : e.target.value;

    console.log(response.current.values[index]);
    const n_null = response.current.values.filter((v,i) => {
      //console.log(v,i)
      return content.requiredQuestions.includes(i) && (v === null || v===undefined)
    }).length
    //console.log('n_null', n_null)
    onValidate(n_null === 0)
  }

  const renderQuestion = (q, index) => {
    return (
      <Grid item key={index} className='matrix-question-container'>
      <Markdown source={t(q)} escapeHtml={false} className='markdown-text' />
      {slider && renderSlider(choices, index)}
      {!slider && 
        <RadioGroup name={`q${index}`} value={response.current.values[index]} onChange={(e) => handleChange(e, index)}>
        <Grid container 
          direction={direction==='vertical'?'column':'row'} 
          alignItems='flex-start' 
          justifyContent="space-between">
          {choices.map((c, j) => renderChoice(c, j))}
        </Grid>
        </RadioGroup>
      }
      </Grid>
    ); 
  }

  return (
    <Grid container direction='column' alignItems='stretch' justifyContent='flex-start' className='Text-container'>
      {text && 
      <Grid item>
        <Markdown source={t(text)} escapeHtml={false} className='markdown-text' />
      </Grid>
      }
      {questions
        .map((q,i) => renderQuestion(q,i))
        .reduce((q1, q2) => [q1,<Divider key={Math.random().toString()} className='matrix-spacer'/>,q2])}
    </Grid>
  );
}
