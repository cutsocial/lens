import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Lens source files use JSX inside .js files (a Create React App convention),
// so esbuild is told to parse every .js file in src/ as JSX.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ })],
  base: '/',
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  // Kept from Create React App so existing code works unchanged.
  // PUBLIC_URL was '' because the site is served from the domain root.
  define: {
    'process.env.PUBLIC_URL': JSON.stringify(''),
  },
  // vfile (via react-markdown v4) imports Node's 'path'; use the browser port.
  resolve: { alias: { path: 'path-browserify' } },
  server: { port: 3000 },
  // Same output folder as before, so the deploy workflow and gh-pages script still work.
  build: { outDir: 'build' },
});
