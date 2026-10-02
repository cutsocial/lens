import { createTheme, responsiveFontSizes } from '@mui/material';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

// Persian/Arabic text reads best in Vazir; Latin text in the system UI font.
// Vazir stays in both lists as a fallback.
const systemFonts = [
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
];
const ltrFontFamily = [...systemFonts.slice(0, 5), 'Vazir', ...systemFonts.slice(5)].join(',');
const rtlFontFamily = ['Vazir', ...systemFonts].join(',');

const makeTheme = (direction) => responsiveFontSizes(createTheme({
  direction,
  palette: {
    mode: 'dark',
    primary: { main: '#039be5' },
    secondary: { main: '#f06292' },
    // Default dark-mode secondary text is 70% white, which reads as dim grey
    // on small labels. Raised for legibility.
    text: { secondary: 'rgba(255, 255, 255, 0.82)' },
    // v4's dark-mode surfaces; v5 defaults to near-black #121212.
    background: { default: '#303030', paper: '#424242' },
  },
  typography: {
    fontFamily: direction === 'rtl' ? rtlFontFamily : ltrFontFamily,
    // Survey questions, answer labels and instructions: 18px instead of 16px.
    body1: { fontSize: '1.125rem', lineHeight: 1.6 },
    body2: { fontSize: '1rem', lineHeight: 1.5 },
  },
  components: {
    // MUI v5 lightens dark-mode Paper by elevation; v4 did not. Keep the v4 look.
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    // v4 buttons without a color prop were neutral ("default"); v5 makes them
    // primary blue. Keep the neutral look and v4's subtle outline.
    MuiButton: {
      defaultProps: { color: 'inherit' },
      styleOverrides: { outlinedInherit: { borderColor: 'rgba(255, 255, 255, 0.23)' } },
    },
  },
}));

export const ltrTheme = makeTheme('ltr');
export const rtlTheme = makeTheme('rtl');

// Style caches for MUI's styling engine. The RTL cache mirrors component
// styles (margins, padding, alignment) for Persian and Arabic.
// prepend: false injects MUI styles after Lens's own CSS, as MUI v4 did, so
// existing CSS keeps losing ties to MUI exactly as before (e.g. Container
// centering beats `.study-container { margin: 2vh }`).
export const ltrCache = createCache({ key: 'mui', prepend: false });
export const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin], prepend: false });
