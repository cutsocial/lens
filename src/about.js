import React from 'react';

// lens.cut.social with no study in the address. The page is dark (index.html),
// so the text is light.
export default function About() {
  return (
    <div className="about" style={{ color: '#f3f4f6', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Lens</p>
      <p style={{ margin: 0 }}>
        <a href="https://cut.social" style={{ color: '#5aa9ff' }}>About Lens and the demos</a>
        {' · '}
        <a href="#/builder" style={{ color: '#5aa9ff' }}>Study builder</a>
      </p>
    </div>
  );
}
