/**
 * Text page, Lens 2 ("type": "text2"). Same options and data as classic
 * "text": an instruction page (`instruction: true`), a free-text answer, or a
 * country (`autoComplete: "countries"`, stores the ISO code). `required`
 * blocks Next until there is an answer. Unanswered fields store null.
 *
 * Changed on purpose:
 *  - the answer is stored when Next is pressed, not when the page unmounts,
 *    so a question on a study's last page is saved too (classic lost it)
 *  - a missing answer shows inline under the question instead of a pop-up
 *
 * `prefill` is used by prolific2 for a value taken from the study link.
 */
import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from './components';
import { SurveyPage, FieldError, CountryPicker, useDir } from './survey';

export default function Text2({ content, onStore, prefill }) {
  const { t } = useTranslation();
  const dir = useDir();
  const uid = useId();
  const inputRef = useRef(null);

  const isCountry = content.autoComplete === 'countries';
  const asksForAnswer = !content.instruction;
  const [value, setValue] = useState(prefill !== undefined && prefill !== null && prefill !== '' ? prefill : null);
  const [tried, setTried] = useState(false);

  const response = isCountry ? (value ? value.code : null) : value;
  const answered = response !== null && response !== undefined && response.length > 0;
  const showError = tried && asksForAnswer && content.required && !answered;

  const onNext = () => {
    if (asksForAnswer && content.required && !answered) {
      setTried(true);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    onStore({ view: content, response }, true);
  };

  const label = content.placeholder ? t(content.placeholder) : '';
  const questionId = `${uid}-q`;
  const errorId = `${uid}-err`;

  return (
    <SurveyPage dir={dir} nextLabel={t('next')} onNext={onNext}>
      <div className="l2-card l2-survey-card">
        <div id={questionId}>
          <Text source={t(content.text)} className={asksForAnswer ? 'l2-survey-text l2-survey-question' : 'l2-survey-text'} />
        </div>
        {asksForAnswer && isCountry && (
          <CountryPicker
            value={value}
            onChange={setValue}
            label={t('text.choose_a_country')}
            noOptions={t('text.no_options')}
            inputRef={inputRef}
            labelledBy={questionId}
            describedBy={showError ? errorId : undefined}
            invalid={showError}
          />
        )}
        {asksForAnswer && !isCountry && (
          <div className="l2-field">
            {label && <label id={`${uid}-label`} className="l2-field-label" htmlFor={`${uid}-input`}>{label}</label>}
            <input
              id={`${uid}-input`}
              ref={inputRef}
              className={`l2-input ${showError ? 'is-invalid' : ''}`}
              type="text"
              aria-labelledby={label ? `${questionId} ${uid}-label` : questionId}
              aria-describedby={showError ? errorId : undefined}
              aria-invalid={showError || undefined}
              value={value || ''}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
        {showError && <FieldError id={errorId} message={t('lens2.survey.required')} />}
      </div>
    </SurveyPage>
  );
}
