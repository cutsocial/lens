// react-markdown v4 (used for task instructions) depends on vfile, which calls
// Node's process.cwd(). Create React App's webpack 4 supplied browser stand-ins
// for Node globals automatically; Vite does not, so this provides the one needed.
// In development another dependency may already define a partial `process`
// (env only), so add each missing piece rather than checking for `process` alone.
const proc = (globalThis.process = globalThis.process || {});
proc.env = proc.env || {};
if (typeof proc.cwd !== 'function') proc.cwd = () => '/';
