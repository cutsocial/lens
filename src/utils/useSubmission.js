/**
 * Sends a study's responses once, shared by the classic and Lens 2 final pages.
 * - retries with backoff if the save fails (2s, 4s, 8s, 16s)
 * - sends a submissionId so retries are never double-counted
 * - after the last failed attempt, returns a fallback code so the page can
 *   still show the completion note and participants aren't stuck
 * - no participant data or Prolific IDs go to Google Analytics, only errors
 *
 * Returns {status: 'sending' | 'saved' | 'failed', submissionCode}.
 */
import { useEffect, useRef, useState } from 'react';
import ReactGA from 'react-ga4';

const API = 'https://server.cut.social/api/v1';
const MAX_ATTEMPTS = 5;

const newSubmissionId = () =>
  (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function useSubmission(submission, studyId) {
  const [status, setStatus] = useState('sending');
  const [submissionCode, setSubmissionCode] = useState(undefined);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;   // submit exactly once
    started.current = true;

    const submissionId = newSubmissionId();
    const payload = JSON.stringify({ ...submission, submissionId });

    const send = async (attempt) => {
      try {
        const resp = await fetch(`${API}/${studyId}/responses`, {
          method: 'POST',
          mode: 'cors',
          body: payload,
          headers: { 'Content-Type': 'application/json' }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        setSubmissionCode(json.submissionCode);
        setStatus('saved');
      } catch (error) {
        ReactGA.event({
          category: 'error',
          action: 'submission_failed',
          label: `${studyId} attempt ${attempt}: ${error.message}`
        });
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => send(attempt + 1), 1000 * 2 ** attempt);
        } else {
          setSubmissionCode(submissionId.slice(0, 8).toUpperCase());
          setStatus('failed');
        }
      }
    };

    send(1);
  }, []);

  return { status, submissionCode };
}
