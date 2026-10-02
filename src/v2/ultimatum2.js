/**
 * Ultimatum game, Lens 2 ("type": "ultimatum2"). Same options and data as
 * classic "ultimatum"; see tokenGame.js for what is kept and what changed.
 */
import React from 'react';
import TokenGame from './tokenGame';

export default function Ultimatum2({ content, onStore }) {
  return <TokenGame game="ultimatum" content={content} onStore={onStore} />;
}
