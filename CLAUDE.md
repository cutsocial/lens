# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Vite 6, React 18, MUI v5, Node 20 per `.nvmrc`. No linter. Tests use Node's built-in runner (`npm test`, files `src/**/*.test.js`); so far only `src/multiplayer/` has them. Source files keep JSX in `.js` files; `vite.config.js` tells esbuild to parse them as JSX.

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
- `src/submission.js` (via `src/utils/useSubmission.js`) POSTs `{...submission, submissionId}` to `https://server.cut.social/api/v1/{studyId}/responses`. It retries with backoff (up to 5 attempts, `submissionId` prevents double-counting) and still shows the completion note if all attempts fail. Participant data and Prolific IDs must not be sent to Google Analytics; only error events are.

### View components contract

Each view `type` in the JSON maps to a component through the `switch` in `Study.renderView` (`src/study.js`). Adding a new task type takes three edits in `study.js`: the import, a `case` in `renderView`, and, if the task drives its own navigation, adding the type to the hard-coded list that hides the shared `<Navigation>` "Next" button. Then add the type (and any new option on an existing type) to `schema/study.schema.json`; `npm run validate` rejects unknown types and keys. Components receive `content` (the JSON view object) and `onStore`, plus optionally `onProgress`, `onNotification`, and `onValidate`.

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
- `useTrialRunner.js`: the shared trial engine (tasks supply timeout scoring, key mapping and optional progress reporting) (fixation, stimulus, feedback, reset). It deliberately reproduces classic semantics: timeouts counted over the whole run, reset clears responses but keeps trial order, one fixation interval after the last trial before finishing. Records carry the classic fields plus timingVersion 2 fields.
- A Lens 2 task's response = the classic task's response fields + `taskVersion: 2`. Verify any new task against its classic sibling with identical scripted sessions before shipping.
- Study page renders `LENS2_TYPES` without the classic card wrapper. Stimuli (colors, words, sizes) come from the study file or keep classic values; never restyle them through the design system.
- Interface strings live under `lens2.*` keys in all three locale files.
- `singleResponseTask.js`: shared component for one-response tasks (tap the stage or press Space; withholding is the other answer). Draws stimuli with the classic CSS classes from `nback.css`, so letters/icons/fixation look identical to classic.
- `bart2.js`: BART with the classic explosion deck, balloon size and data; orange Lens 2 ball by default (`stimulusStyle: "classic"` for the red bubble); optional `ballScale`.
- `tokenGame.js`: shared dictator/ultimatum screen (coin piles per person, pointer-event drag, optional `tapControls`, dictator `matchmakingDelay`).
- `survey.js`: survey page shell (Next button, inline required message), `ScaleSlider`, `CountryPicker`. `text2.js`, `matrix2.js`, `prolific2.js` use it. Survey views store on Next with `onStore(data, true)` (not in an unmount cleanup), so `Study.onNext` skips its required check for Lens 2 types; survey CSS is in rem so `fontScale` applies.
- `submission2.js`: Lens 2 final page, used when a study has any Lens 2 view (override with `finalPage`). Saving and retries are in `src/utils/useSubmission.js`, shared with classic `src/submission.js`.
- Current Lens 2 types: `stroop2`, `gonogoalt2`, `nback2`, `bart2`, `dictator2`, `ultimatum2`, `text2`, `matrix2`, `prolific2`, and `multiplayer` (below). Demo: `/#/demo-lens2/en`.

## Multiplayer games (view type `multiplayer`)

Live two-player ultimatum and dictator games, rebuilt from Cut (see `cut-port-spec.md` in the project docs). Matching and moves run on the server (`cutsocial/submission-server`, `multiplayer/`, routes under `server.cut.social/mp`), which stores matches in the `lens` Firestore database in `jamasp-gcp-project` and checks every move with the same rules.

- `src/multiplayer/config.js`: study-file options and defaults (`normalizeConfig`); mirrored for authors in `schema/study.schema.json` `$defs/multiplayer`. The validator runs `normalizeConfig` on every multiplayer view.
- `src/multiplayer/engine.js`, `bots.js`: pure game rules and Cut's bots (fair, rational, hyperRational, simple), plus data output (`moveRows`, `playerSummary`). The server has a copy in `multiplayer/engine/`; change rules here first (tests: `npm test`), then copy them there. Change bot rules only with the user's agreement; they define what published data meant.
- `src/multiplayer/client.js`: anonymous Firebase sign-in, calls to `/mp`, live updates of the participant's own match (Firestore `onSnapshot`). Firebase is loaded only when a study has a multiplayer view (separate chunks). `VITE_MP_DEV=1` swaps Firebase for the server's local dev mode (polling).
- `src/v2/multiplayer.js`: the screen. Instructions → optional practice against a computer → finding a partner (computer after `matching.timeout` unless `botFallback` is false) → rounds (drag or +/−) → debrief (on by default; `textBot`/`textHuman`) → stores `playerSummary` + matchId, waitMs, endReason, debrief time, practice summary, `taskVersion: 2`. Heartbeats every 10 s; a partner silent for 30 s, or not moving within `turnTimeout` on their turn, ends the match as abandoned.
- The partner looks the same whether a person or a computer; the debrief says which. Prolific requires a debrief for everyone in deception studies (incl. dropouts): the server's `/mp/export` lists who never saw it.
- Browser tests: `scripts/e2e/` (two players, computer partner, practice in Persian, partner leaving, silent partner), against the server's local dev mode. See its README.
- Demo: `/#/demo-multiplayer/en` (open in two windows). `test-multiplayer.json` is for the tests only.

## Experiments (`public/experiments/*.json`)

Each file is a study. Top-level keys: `studyId`, `condition`, `redirectTo`, `submissionNote` (an i18n key; receives `{{submissionCode}}`), `metadata`, `views[]`. `schema/study.schema.json` defines every view type and option (run `npm run validate` after editing a study file); `public/experiments/demo-comprehensive.json` exercises every classic view type; `demo-lens2.json` every Lens 2 type, and `demo-<task>.json` one Lens 2 task each (linked from `README.md`, which lists the types). Many `mad*.json` files are real published studies, so avoid changing them unless asked.

Prolific integration: `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` are read from the URL query string in `Study` and sent with the submission. `ASSIGNMENT_ID` (set by the server's `/assign`) is sent too, only when present.

Per-page save: with `"saveProgress": true`, `Study.storeData` calls `saveView` (`src/utils/api.js`) for every stored entry, in the background, with the submission id created at study start (the final submission reuses it). It reads only refs because classic survey views call a stale `storeData` from their unmount cleanup. `VITE_SUBMISSION_API` overrides the server address for local testing.

Google Analytics (`react-ga4`, ID hard-coded in `src/index.js` and `src/study.js`) is used only for pageviews and submission-failure events.

## Backend and infrastructure

- Submissions go to a Cloud Run server at `server.cut.social` (GCP project `jamasp-gcp-project`), which writes to MongoDB Atlas. Multiplayer matches go to Firestore (database `lens`) through the same server. Its code is in the private repo `cutsocial/submission-server`. It does not store participant IP addresses (`STORE_IP` is off).
- Heroku is no longer used. If you come across a Heroku reference (URLs, config, docs, comments), flag it to the user. As of the last check there were none in the repo.

## Roadmap

Planned work, in this order:

1. ~~Restrict the deploy workflow to `master`.~~ Done.
2. ~~Fix reaction-time measurement (`performance.now()`, stimulus onset).~~ Done.
3. ~~Save data per view instead of only once at the end.~~ Done as opt-in `saveProgress` (rows in `<studyId>.partial`; final document unchanged).
4. ~~Balanced randomization.~~ Done on the server: `/assign` (balanced by completes + active holds); `/randomize` unchanged.
5. ~~JSON schema validation for study definitions in `public/experiments/`.~~ Done: `schema/study.schema.json` + `npm run validate` (`scripts/validate-studies.js`), run in CI on pull requests.
6. ~~Migrate to Vite, React 18 and MUI v5.~~ Done (branch `upgrade-vite-react18-mui5`).

## Data format constraint

Any change that affects collected data (response shape, timing fields, submission payload, view config echoed into results) must not alter the existing data format without asking the user first. This includes roadmap items 2 and 3.
