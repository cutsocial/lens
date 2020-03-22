import React, { useEffect, useState, Fragment } from 'react';
import { Typography, Divider, Box, TextField, Grid } from '@material-ui/core';

import Markdown from 'react-markdown';

export default function Text(props) {

  const [data] = useState({value: null});
  //props: title, text, placeholder, help, required, pattern, instruction

  //to store data on pressing next
  useEffect(() => {
    // store data as a cleanup side-effect (on WillUnmount)
    return () => { props.onNext(data) };
  },[data, props]);

  return (
    <Grid container direction='column' spacing={2} alignItems='stretch' justify='flex-start' className='Text-container'>
      <Grid item>
        <Markdown source={props.content.text} escapeHtml={false} />
      </Grid>
      {!(props.content.instruction || false) &&
        <Grid item>
          <TextField label={props.content.placeholder} variant="filled" fullWidth />
        </Grid>
      }
    </Grid>
  );
}