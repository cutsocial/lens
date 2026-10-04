/**
 * /#/__preview/:lang — shown inside the study builder's preview frame.
 * The builder posts {type: 'lens-preview', experiment, startIndex} and the
 * study is shown from that page, in preview mode (nothing is saved or sent).
 * Each new message restarts the study, so edits show up at once.
 */
import React, { useEffect, useState } from 'react';
import Study from '../study';

export default function PreviewHost() {
  const [preview, setPreview] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== 'lens-preview' || !d.experiment) return;
      setPreview({ experiment: d.experiment, startIndex: d.startIndex || 0 });
      setVersion((v) => v + 1);
    };
    window.addEventListener('message', onMessage);
    // tell the builder we're ready for a study
    if (window.parent !== window) window.parent.postMessage({ type: 'lens-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!preview || !(preview.experiment.views || []).length) {
    return <div style={{ color: '#a6acb8', font: '15px system-ui, sans-serif', padding: 24, textAlign: 'center' }}>Add a page to see it here.</div>;
  }
  return <Study key={version} preview={preview} onRestart={() => { setPreview({ ...preview, startIndex: 0 }); setVersion((v) => v + 1); }} />;
}
