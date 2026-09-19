# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Create React App (`react-scripts` 4.0.3, React 16, Material-UI v4, Node 16 per `.nvmrc`). No linter beyond CRA's built-in `eslintConfig`, and there are currently no tests in `src/`.

- `npm start` — dev server at http://localhost:3000. On newer Node versions that fail with an OpenSSL error, use `npm run devstart` (adds `--openssl-legacy-provider`).
- `npm run build` — production build into `build/` (`CI=false` so ESLint warnings don't fail it).
- `npm test` — Jest via react-scripts (watch mode). Single test: `npm test -- -t "name"` or pass a file path.
- `npm run deploy` — builds and publishes `build/` to `gh-pages`. CI (`.github/workflows/`) also builds and deploys to GitHub Pages on push to `master`, `mirror`, `develop`. Site is served at `lens.cut.social` (`public/CNAME`).

## Architecture

Lens is a client-only SPA that renders a **study** described by a JSON file, then POSTs the collected responses to an external API. There is no backend in this repo.

### Request flow

- `src/router.js` uses `HashRouter`: `/#/:studyId/:lang` → `Study`; `/#/:studyId` → `LanguageSelector`; `/` → `About`.
- `src/study.js` is the orchestrator. It fetches `public/experiments/{studyId}.json` at runtime, then steps through `experiment.views` by index, holding `responses`, `progress`, and `currentViewIndex` in local state. When the last view is done it renders `Submission` instead.
- Language (`en`, `fa`, `ar`) comes from the URL; `languages[lang].direction` picks the RTL or LTR MUI theme (`src/utils/theme.js`). Add new languages in `src/utils/i18n.js` **and** `public/locales/{lang}.json`. Locale files are fetched by `i18next-xhr-backend`, not bundled, and `keySeparator` is `false`, so keys like `income.self.q` are flat strings.
- Experiment JSON strings (`text`, `choices`, `questions`, …) are mostly **i18n keys**, resolved with `t()`. Plain text like `"Thanks!"` falls through as the key itself.
- `src/submission.js` POSTs `{...submission, submissionId}` to `https://server.cut.social/api/v1/{studyId}/responses`. It retries with backoff (up to 5 attempts, `submissionId` prevents double-counting) and still shows the completion note if all attempts fail. Participant data and Prolific IDs must not be sent to Google Analytics; only error events are.

### View components contract

Each view `type` in the JSON maps to a component through the `switch` in `Study.renderView` (`src/study.js`). Adding a new task type takes three edits in `study.js`: the import, a `case` in `renderView`, and, if the task drives its own navigation, adding the type to the hard-coded list that hides the shared `<Navigation>` "Next" button. Components receive `content` (the JSON view object) and `onStore`, plus optionally `onProgress`, `onNotification`, and `onValidate`.

There are two patterns for reporting results, and it matters which one a component uses:

- **Survey views** (`text`, `matrix`, `prolific`): call `onStore({view: content, response})` from a `useEffect` **cleanup**, i.e. when the view unmounts as the participant clicks Next. They call `onValidate(bool)` to tell `Study` whether required answers are filled (checked against `view.required` / `view.requiredQuestions` in `onNext`).
- **Interactive tasks** (`bart`, `gonogo`, `gonogoalt`, `stroop`, `taskswitch`, `simplified_taskswitch`, `nback`, `ultimatum`, `dictator`): run their own trial state machine and call `onStore({view, response}, true)` when done. The `true` (`autoNext`) advances to the next view. Timing-sensitive tasks call `onProgress(pct)` to drive the top progress bar.

Every stored entry is `{view, response}`. The full `view` config is echoed into the results so data is self-describing.

### Task implementations

Tasks are large single-file components (200–340 lines) with a paired `.css`, and hold the trial logic, timers, and key handlers inline. There is little shared code: `src/utils/` has `random.js`/`shuffle.js`, `hooks.js` (`useTimeout`), `countries.js`, and `src/components/allotmentBox.js`. Tasks share similar structure but are copy-adapted, so a fix in one (e.g. `gonogo.js` vs `gonogoalt.js`, `taskswitch.js` vs `simplified_taskswitch.js`) usually needs checking in its sibling.

## Experiments (`public/experiments/*.json`)

Each file is a study. Top-level keys: `studyId`, `condition`, `redirectTo`, `submissionNote` (an i18n key; receives `{{submissionCode}}`), `metadata`, `views[]`. `public/experiments/demo-comprehensive.json` exercises every view type and is the best schema reference; `README.md` lists the types. Many `mad*.json` files are real published studies, so avoid changing them unless asked.

Prolific integration: `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` are read from the URL query string in `Study` and sent with the submission.

Google Analytics (`react-ga4`, ID hard-coded in `src/index.js` and `src/study.js`) is used only for pageviews and submission-failure events.

## Backend and infrastructure

- Submissions go to a Cloud Run server at `server.cut.social` (GCP project `jamasp-gcp-project`), which writes to MongoDB Atlas. The server code is not in this repo.
- Heroku is no longer used. If you come across a Heroku reference (URLs, config, docs, comments), flag it to the user. As of the last check there were none in the repo.

## Roadmap

Planned work, in this order:

1. Restrict the deploy workflow (`.github/workflows/`) to `master`. It currently also deploys from `mirror` and `develop`.
2. Fix reaction-time measurement: use `performance.now()` and record stimulus-onset timestamps.
3. Save data per view instead of only once at the end.
4. Balanced randomization.
5. JSON schema validation for study definitions in `public/experiments/`.
6. Migrate to Vite, React 18 and MUI v5.

## Data format constraint

Any change that affects collected data (response shape, timing fields, submission payload, view config echoed into results) must not alter the existing data format without asking the user first. This includes roadmap items 2 and 3.
