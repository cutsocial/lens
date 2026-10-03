/**
 * Question matrix, Lens 2 ("type": "matrix2"). Same options and data as
 * classic "matrix": `questions` share one set of `choices`, answered with
 * radio buttons (`direction` "vertical" or horizontal) or a slider
 * (`slider: true`, optional `showMidMark`). `requiredQuestions` lists the
 * question indexes that must be answered.
 *
 * Response, as classic: {values: [...]} with one entry per question: the
 * choice key for radios, 1..choices.length for sliders, null if unanswered.
 *
 * Changed on purpose:
 *  - each question sits on its own card; horizontal choices stack into rows
 *    on narrow screens so every option stays a full-width tap target.
 *    `"mobileLayout": "row"` keeps them in one row on phones too (default
 *    "stack"); it is echoed with the view, so the layout is in the data
 *  - the slider shows nothing selected until it is touched (as classic), and
 *    shows the chosen label above the line instead of in a tooltip
 *  - missing answers show inline under each question, and Next scrolls to
 *    the first one
 *  - answers are stored when Next is pressed, not on unmount, so the last
 *    page of a study is saved too
 */
import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from './components';
import { SurveyPage, FieldError, ScaleSlider, useDir } from './survey';

const isUnanswered = (v) => v === null || v === undefined;

export default function Matrix2({ content, onStore }) {
  const { questions, choices, direction, text, slider, showMidMark } = content;
  const required = content.requiredQuestions || [];
  const { t } = useTranslation();
  const dir = useDir();
  const uid = useId();
  const cards = useRef([]);

  const [values, setValues] = useState(() => Array.from({ length: questions.length }, () => null));
  const [tried, setTried] = useState(false);

  const missing = required.filter((i) => i < questions.length && isUnanswered(values[i]));

  const setValue = (index, v) => setValues((prev) => {
    const next = [...prev];
    next[index] = v;
    return next;
  });

  const onNext = () => {
    if (missing.length > 0) {
      setTried(true);
      const card = cards.current[missing[0]];
      if (card) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        const control = card.querySelector('input, [role="slider"]');
        if (control) control.focus({ preventScroll: true });
      }
      return;
    }
    onStore({ view: content, response: { values } }, true);
  };

  const horizontal = direction !== 'vertical';
  const rowOnPhones = content.mobileLayout === 'row';

  const renderQuestion = (q, i) => {
    const qid = `${uid}-q${i}`;
    const eid = `${uid}-e${i}`;
    const showError = tried && missing.includes(i);
    return (
      <div key={i} className={`l2-card l2-survey-card ${showError ? 'is-invalid' : ''}`} ref={(el) => { cards.current[i] = el; }}>
        <div id={qid}>
          <Text source={t(q)} className="l2-survey-text l2-survey-question" />
        </div>
        {slider ? (
          <ScaleSlider
            choices={choices}
            value={values[i]}
            onChange={(v) => setValue(i, v)}
            labelledBy={qid}
            describedBy={showError ? eid : undefined}
            dir={dir}
            showMidMark={showMidMark}
            hint={t('lens2.survey.slider_hint')}
            t={t}
          />
        ) : (
          <div
            role="radiogroup"
            aria-labelledby={qid}
            aria-describedby={showError ? eid : undefined}
            className={`l2-options ${horizontal ? 'l2-options-row' : ''} ${horizontal && rowOnPhones ? 'l2-options-row-always' : ''}`}
            style={horizontal ? { '--l2-n': choices.length } : undefined}
          >
            {choices.map((c, j) => {
              const on = values[i] === c;
              return (
                <label key={c + j} className={`l2-option ${on ? 'is-on' : ''}`}>
                  <input type="radio" name={qid} value={c} checked={on} onChange={() => setValue(i, c)} />
                  <span>{t(c)}</span>
                </label>
              );
            })}
          </div>
        )}
        {showError && <FieldError id={eid} message={t('lens2.survey.required')} />}
      </div>
    );
  };

  return (
    <SurveyPage dir={dir} nextLabel={t('next')} onNext={onNext}>
      {text && <Text source={t(text)} className="l2-survey-text l2-survey-intro" />}
      {questions.map(renderQuestion)}
    </SurveyPage>
  );
}
