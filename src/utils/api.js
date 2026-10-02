/**
 * Submission server address and the per-page save.
 * VITE_SUBMISSION_API overrides the server (e.g. for local testing).
 */
export const API = import.meta.env.VITE_SUBMISSION_API || 'https://server.cut.social/api/v1';

export const newSubmissionId = () =>
  (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

const PAGE_ATTEMPTS = 3;

/**
 * Saves one stored entry ({view, response}) as the participant goes. Runs in
 * the background and never blocks or interrupts the study; the full
 * submission at the end is still sent as before. Retries are idempotent:
 * the server keeps one row per (submissionId, index).
 */
export function saveView(studyId, submissionId, index, entry, meta) {
  const body = JSON.stringify({ ...meta, entry });
  const send = (attempt) => {
    fetch(`${API}/${studyId}/responses/${submissionId}/views/${index}`, {
      method: 'PUT',
      mode: 'cors',
      keepalive: body.length < 60000,   // lets the last save finish if the tab closes
      body,
      headers: { 'Content-Type': 'application/json' },
    })
      .then((resp) => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); })
      .catch(() => {
        if (attempt < PAGE_ATTEMPTS) setTimeout(() => send(attempt + 1), 1500 * attempt);
      });
  };
  send(1);
}
