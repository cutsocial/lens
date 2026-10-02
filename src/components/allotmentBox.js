import React, { Fragment, memo } from 'react';
import { useDrag, useDrop, DragPreviewImage } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { languages } from '../utils/i18n';
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import { grey, blueGrey } from '@mui/material/colors';
import { Avatar, Grid, Paper, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

// Item types of draggable components
export const ItemTypes = {
  OPPONENT: 'opponent',
  POT: 'pot',
  PLAYER: 'player',
}

// Styles formerly built with makeStyles (removed in MUI v5); same values as sx objects.
// theme.spacing(n) is n*8px.
const sxLarge = { width: 32, height: 32 };
const sxCountAvatar = (theme) => ({ ...sxLarge, color: theme.palette.getContrastText(grey[400]), bgcolor: grey[400] });


var language = undefined;
var personsLangPrefix = undefined;

/***
 * Container box for monetized entities and their interactions
 */
export const RepositoryBox = memo(function RepositoryBox({
  name,
  amount,
  onDrop,
  accept,
  person,
  personsPrefix,
}) {

  let { lang } = useParams();
  language = lang;
  personsLangPrefix = personsPrefix;
  console.log(personsLangPrefix);
  const { t } = useTranslation();
  const style = {
    minHeight: '128px', // grows when profile text wraps (phones, larger text)
    display: 'flex',    // keeps content vertically centered now that height can vary
    alignItems: 'center',
  }

  const [{ canDrop, isOver }, drop] = useDrop({
    accept,
    drop: onDrop,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      //connectDropTarget: connect.dropTarget()
    }),
  })

  const isActive = canDrop && isOver
  let backgroundColor = '#222'
  if (isActive) {
    backgroundColor = 'darkgreen'
  } else if (canDrop) {
    backgroundColor = blueGrey[800]
  }

  const tokensList = [];
  for (let i = 0; i < amount; i++) {
    tokensList.push(<MonetizedToken type={name} name={name + i.toString()} key={name + i.toString()} boxName={name} />);
  }

  return (
    <Grid item xs={12}>
      <Paper ref={drop} sx={{ p: 2 }} style={{ ...style, backgroundColor }} elevation={3} >
        <Grid container alignItems="center" direction="row" sx={{ height: '100%' }}>
          <Grid item xs={4}>
            {name === ItemTypes.OPPONENT &&
              <OpponentInfoBar person={person} />
            }
            {name !== ItemTypes.OPPONENT &&
              <Typography>{t('dictator.' + name)}</Typography>
            }
          </Grid>
          <Grid item xs={7}>
            <Grid container direction="row" justifyContent="flex-start" alignItems="center">
              {tokensList}
            </Grid>
          </Grid>
          <Grid item xs={1}>
            <Grid container direction="column" justifyContent="center" alignItems="center">
              <Avatar sx={sxCountAvatar}>{amount}</Avatar>
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </Grid>
  );
})

/**
 * uses the persons id and the field key alongside experiment loaded personLangPrefix to produce the locales key
 * @returns string for locales key
 */
function getPersonKey(key, id) {
  console.log(personsLangPrefix);
  return personsLangPrefix + id + '.' + key;
}

const OpponentInfoBar = memo(function OpponentInfoBar({ person }) {
  const { t } = useTranslation();
  return (
    <>
      {person?.avatar &&
        <Avatar alt={t(getPersonKey(person.field1, person.id))} src={process.env.PUBLIC_URL + "/images/" + person.avatar} sx={sxLarge} />
      }
      {!person?.avatar &&
        <Avatar sx={sxLarge} />
      }
      <Typography variant="body1" color="textPrimary" component="p">
        {person?.field1 && t(getPersonKey(person.field1, person.id))}
      </Typography>
      <Typography variant="body2" color="textSecondary" component="p">
        {person?.field2 && t(getPersonKey(person.field2, person.id))}
      </Typography>
      <Typography variant="body2" color="textSecondary" component="p">
        {person?.field3 && t(getPersonKey(person.field3, person.id))}
      </Typography>
    </>
  );
})

/***
 * Component which renders coin tokens and handles dragging events
 */
const MonetizedToken = memo(function MonetizedToken({ type, name, boxName }) {

  const style = {
    cursor: 'move',
  }

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type,
      item: { name, boxName },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [name],
  )
  return (
    <Grid item>
      <DragPreviewImage connect={preview} src={process.env.PUBLIC_URL + "/images/token-large.png"} />
      <span ref={drag} className='token-span' style={{ ...style, opacity: isDragging ? 0.5 : 1,}}> 
        <MonetizationOnIcon fontSize={isDragging? 'large':'medium'} /> 
      </span>
    </Grid>

  )
})