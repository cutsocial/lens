# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Vite 6, React 18, MUI v5, Node 20 per `.nvmrc`. No linter, and there are currently no tests in `src/`. Source files keep JSX in `.js` files; `vite.config.js` tells esbuild to parse them as JSX.

- `npm start` — Vite dev server at http://localhost:3000.
- `npm run build` — production build into `build/`. `npm run preview` serves it locally.
- `npm run deploy` — builds and publishes `build/` to `gh-pages`. CI (`.github/workflows/deploy_pages.yml`) builds and deploys to GitHub Pages on push to `master`. Site is served at `lens.cut.social` (`public/CNAME`).
- No `<React.StrictMode>`: in development it runs effect cleanups twice, and survey views store responses in a cleanup.
- `src/polyfills.js` and the `path` alias in `vite.config.js` exist only for react-markdown v4 (via vfile). Remove both if react-markdown is upgraded.

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

## Lens 2 (`src/v2/`)

Lens 2 tasks are new view types that sit next to the classic ones; classic types are frozen so existing studies and their data stay comparable (classic = release tag `v1.0`).

- `lens2.css`: design tokens ("Quiet Instrument") as CSS variables on `.l2`, plus shared classes. Logical CSS properties, so RTL works from `dir`.
- `components.js`: `L2Root`, `Header`, `StartCard`, `NoticeCard`, `Feedback`, `Button`, `Keys`. Fonts are bundled (`@fontsource/atkinson-hyperlegible-*`), not loaded from Google.
- `useTrialRunner.js`: the shared trial engine (fixation, stimulus, feedback, reset). It deliberately reproduces classic semantics: timeouts counted over the whole run, reset clears responses but keeps trial order, one fixation interval after the last trial before finishing. Records carry the classic fields plus timingVersion 2 fields.
- A Lens 2 task's response = the classic task's response fields + `taskVersion: 2`. Verify any new task against its classic sibling with identical scripted sessions before shipping.
- Study page renders `LENS2_TYPES` without the classic card wrapper. Stimuli (colors, words, sizes) come from the study file or keep classic values; never restyle them through the design system.
- Interface strings live under `lens2.*` keys in all three locale files.
- Current Lens 2 types: `stroop2`. Demo: `/#/demo-lens2/en`.

## Experiments (`public/experiments/*.json`)

Each file is a study. Top-level keys: `studyId`, `condition`, `redirectTo`, `submissionNote` (an i18n key; receives `{{submissionCode}}`), `metadata`, `views[]`. `public/experiments/demo-comprehensive.json` exercises every view type and is the best schema reference; `README.md` lists the types. Many `mad*.json` files are real published studies, so avoid changing them unless asked.

Prolific integration: `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` are read from the URL query string in `Study` and sent with the submission.

Google Analytics (`react-ga4`, ID hard-coded in `src/index.js` and `src/study.js`) is used only for pageviews and submission-failure events.

## Backend and infrastructure

- Submissions go to a Cloud Run server at `server.cut.social` (GCP project `jamasp-gcp-project`), which writes to MongoDB Atlas. Its code is in the private repo `cutsocial/submission-server`. It does not store participant IP addresses (`STORE_IP` is off).
- Heroku is no longer used. If you come across a Heroku reference (URLs, config, docs, comments), flag it to the user. As of the last check there were none in the repo.

## Roadmap

Planned work, in this order:

1. ~~Restrict the deploy workflow to `master`.~~ Done.
2. ~~Fix reaction-time measurement (`performance.now()`, stimulus onset).~~ Done.
3. Save data per view instead of only once at the end.
4. Balanced randomization.
5. JSON schema validation for study definitions in `public/experiments/`.
6. ~~Migrate to Vite, React 18 and MUI v5.~~ Done (branch `upgrade-vite-react18-mui5`).

## Data format constraint

Any change that affects collected data (response shape, timing fields, submission payload, view config echoed into results) must not alter the existing data format without asking the user first. This includes roadmap items 2 and 3.
