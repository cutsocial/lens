import { createTheme, responsiveFontSizes } from '@mui/material';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

const fontFamily = [
  'Vazir',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(',');

const makeTheme = (direction) => responsiveFontSizes(createTheme({
  direction,
  palette: {
    mode: 'dark',
    primary: { main: '#039be5' },
    secondary: { main: '#f06292' },
  },
  typography: { fontFamily },
  components: {
    // MUI v5 lightens dark-mode Paper by elevation; v4 did not. Keep the v4 look.
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
}));

export const ltrTheme = makeTheme('ltr');
export const rtlTheme = makeTheme('rtl');

// Style caches for MUI's styling engine. The RTL cache mirrors component
// styles (margins, padding, alignment) for Persian and Arabic.
export const ltrCache = createCache({ key: 'mui', prepend: true });
export const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin], prepend: true });
