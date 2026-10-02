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
  },
}));

export const ltrTheme = makeTheme('ltr');
export const rtlTheme = makeTheme('rtl');

// Style caches for MUI's styling engine. The RTL cache mirrors component
// styles (margins, padding, alignment) for Persian and Arabic.
export const ltrCache = createCache({ key: 'mui', prepend: true });
export const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin], prepend: true });
