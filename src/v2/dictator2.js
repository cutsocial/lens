/**
 * Dictator game, Lens 2 ("type": "dictator2"). Same options and data as
 * classic "dictator"; see tokenGame.js for what is kept and what changed.
 */
import React from 'react';
import TokenGame from './tokenGame';

export default function Dictator2({ content, onStore }) {
  return <TokenGame game="dictator" content={content} onStore={onStore} />;
}
