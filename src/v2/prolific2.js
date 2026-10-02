/**
 * Prolific ID page, Lens 2 ("type": "prolific2"). Same options as classic
 * "prolific": a text field prefilled from the study link
 * (`getUrlContent: true` + `paramNameAsContent`, e.g. "PROLIFIC_PID") or from
 * `content`.
 *
 * Changed on purpose: a prefilled value is stored as the answer. Classic
 * stored null unless the participant edited the field, and a prefilled
 * required field could not pass Next.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';

import Text2 from './text2';

export default function Prolific2({ content, onStore }) {
  const query = new URLSearchParams(useLocation().search);
  let prefill = null;
  if (content.getUrlContent === true) {
    if (content.paramNameAsContent) prefill = query.get(content.paramNameAsContent);
  } else if (content.content) {
    prefill = content.content;
  }
  return <Text2 content={content} onStore={onStore} prefill={prefill} />;
}
