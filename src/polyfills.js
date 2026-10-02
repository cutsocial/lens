// react-markdown v4 (used for task instructions) depends on vfile, which calls
// Node's process.cwd(). Create React App's webpack 4 supplied browser stand-ins
// for Node globals automatically; Vite does not, so this provides the one needed.
if (typeof globalThis.process === 'undefined') {
  globalThis.process = { env: {}, cwd: () => '/' };
}
