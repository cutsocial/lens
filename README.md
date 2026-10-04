# Lens

Lens runs online behavioral studies in the browser: surveys, reaction-time tasks and economic games, described in a single JSON file and served at a link you can post on Prolific. It is the successor to [Cut](https://cut.social/), and it supports English, Persian and Arabic, including right-to-left layout, on phones and computers.

## Try it

Each link opens one task in the current design (Lens 2):

* [Survey pages](https://lens.cut.social/#/demo-survey/en): text, country, choice and slider questions
* [Stroop task](https://lens.cut.social/#/demo-stroop/en)
* [Go/No-Go](https://lens.cut.social/#/demo-gonogo/en)
* [N-back](https://lens.cut.social/#/demo-nback/en)
* [Balloon Analogue Risk Task (BART)](https://lens.cut.social/#/demo-bart/en)
* [Dictator game](https://lens.cut.social/#/demo-dictator/en)
* [Ultimatum game](https://lens.cut.social/#/demo-ultimatum/en)
* [Multiplayer ultimatum game](https://lens.cut.social/#/demo-multiplayer/en): open it in two windows to play yourself, or wait 20 seconds for a computer partner
* [All Lens 2 tasks and survey pages in one study](https://lens.cut.social/#/demo-lens2/en)

Replace `/en` with `/fa` or `/ar` to see Persian or Arabic.

The original designs (Lens 1, release `v1.0`) still run every existing study unchanged: [2-alternative forced choice](https://lens.cut.social/#/gonogo/en), [task switching](https://lens.cut.social/#/taskswitch/en), [simplified task switching](https://lens.cut.social/#/simplified_taskswitch/en), and [all classic types in one study](https://lens.cut.social/#/demo-comprehensive/en).

**Make your own study** with the [study builder](https://lens.cut.social/#/builder): pick pages from a menu, fill in forms (or edit the JSON), and see each page live as you go. See [Building a study](#building-a-study).

## Task types

A study is a list of views, shown in order. Each view has a `type`:

| | Lens 2 (current design) | Classic (frozen at `v1.0`) |
|---|---|---|
| Text, questions, instructions | `text2` | `text` |
| Choice grids and sliders | `matrix2` | `matrix` |
| Prolific ID | `prolific2` | `prolific` |
| Stroop | `stroop2` | `stroop` |
| Go/No-Go (letters or icons) | `gonogoalt2` | `gonogoalt` |
| 2-alternative forced choice | | `gonogo` |
| N-back | `nback2` | `nback` |
| BART | `bart2` | `bart` |
| Dictator / ultimatum (pre-recorded opponents) | `dictator2`, `ultimatum2` | `dictator`, `ultimatum` |
| Task switching | | `taskswitch`, `simplified_taskswitch` |
| Live two-player ultimatum / dictator | `multiplayer` | |

A Lens 2 task takes the same study-file options and records the same data fields as its classic version, plus `taskVersion: 2`, so results stay comparable. Reaction-time tasks record stimulus-onset and response times with `performance.now()` (`timingVersion: 2`) next to the original fields.

Lens 2 options worth knowing:

- `stroop2`, `gonogoalt2`, `nback2`: optional `"startText"` (an i18n key) for the start screen. `stroop2`: `"showFixation": true` shows a "+" between trials.
- `bart2`: the balloon is an orange ball; `"stimulusStyle": "classic"` brings back the red bubble. `"ballScale"` enlarges it.
- `dictator2`, `ultimatum2`: `"tapControls": true` adds + and − buttons next to dragging. Dictator's `"matchmakingDelay"` (ms, default 5000) sets the "finding another person" pause.
- `text2`, `matrix2`, `prolific2`: answers are saved when Next is pressed, missing answers are pointed out under the question, and horizontal choices stack on phones (`"mobileLayout": "row"` keeps one row).
- Studies with any Lens 2 view end on the Lens 2 final page. `redirectTo` adds a Continue button (e.g. back to Prolific), with optional `redirectText` and `redirectLabel`. `"finalPage": "classic"` or `"lens2"` overrides the choice.

### Multiplayer games

`multiplayer` pairs participants live, first come, first served. If no one else arrives within `matching.timeout` (default 30 s), a computer partner plays instead (`"matching": {"botFallback": false}` turns that off). The partner looks the same either way; a debrief after the game says which it was. It is on by default, and you can change its text (`debrief.textBot`, `debrief.textHuman`) or turn it off (`"debrief": {"show": false}`).

```json
{ "id": "ug", "type": "multiplayer", "game": "ultimatum", "tokens": 10, "rounds": 3,
  "bot": { "strategy": "fair" }, "bonusPerToken": 0.05 }
```

Other options: `firstProposer` (`random`, `participant`, `partner`), `roles` (`alternate` or `fixed`), `practiceRounds`, `turnTimeout`, and bot delays. Computer partners follow Cut's rules: `fair` offers half and accepts only near-equal splits; `rational` offers half and accepts anything above 0; `hyperRational` offers 1 and accepts anything above 0; `simple` only responds.

Each participant's data includes their rounds from their side, totals, bonus, decision times, whether the partner was a person or a computer (and which strategy), how long they waited, and whether they saw the debrief. The full match data, including who never reached the debrief, comes from the server (see `multiplayer/README.md` in `cutsocial/submission-server`).

If participants are told they play another person, apply Prolific's Deception pre-screener and keep the debrief on: Prolific requires one for everyone, including people who drop out.

## Building a study

The easiest way is the **study builder**: [lens.cut.social/#/builder](https://lens.cut.social/#/builder).

- Add pages from a menu (survey pages, tasks, games), reorder, duplicate or delete them.
- Each page has a form with every option and a short explanation of it. Type text directly; switch the language at the top to add Persian or Arabic versions.
- A live preview shows the selected page as participants will see it (nothing is saved while previewing).
- **Form | JSON** switches the middle column to the study file itself, for editing the JSON directly. Picking a page scrolls to it; edits apply as you type, and JSON errors and problems are marked on their lines.
- Problems are flagged as you type, with the same checks as `npm run validate`.
- **Study settings** shows the study's link for participants (with or without the Prolific parameters, in each language) and whether the published study matches your draft.
- **Open** loads a published study or a file from your computer; **Download** gives the study file. The draft is kept in your browser between visits.
- To publish, upload the downloaded file to `public/experiments/` on GitHub as a pull request (the builder walks you through it). Once merged, the study is live at `lens.cut.social/#/<study id>/en`.

The builder stores a study's text in the study file itself (`"strings"`, below), so a study carries its own wording and translations.

## Writing a study

A study is a file in `public/experiments/`, served at `https://lens.cut.social/#/<file name>/<language>`:

```json
{
  "studyId": "my-study",
  "redirectTo": "https://app.prolific.com/submissions/complete?cc=XXXX",
  "views": [
    { "id": "welcome", "type": "text2", "instruction": true, "text": "Welcome! This takes about 10 minutes." },
    { "id": "bart", "type": "bart2", "reward": 5, "maxPumps": 20, "safePumps": 1, "trials": 10 }
  ]
}
```

- Text in a study file is either plain text or an **i18n key**. Keys are looked up first in the study's own `"strings"` (`{"en": {"key": "text"}, "fa": {…}}`), then in the shared `public/locales/en.json`, `fa.json` and `ar.json`. That is how one study runs in several languages. Markdown works in all of them.
- Top-level options: `redirectTo`, `submissionNote`, `fontScale` (larger survey text, e.g. `1.2`; tasks are never scaled), `saveProgress` (below), `finalPage`, `metadata` (free-form notes).
- `schema/study.schema.json` describes every type and option. In VS Code you get autocomplete and an explanation when you hover a key.
- The `demo-*.json` files are good starting points.

### Checking a study file

`npm run validate` checks every study file (`npm run validate -- public/experiments/my-study.json` for one). It runs on every pull request too.

- **Errors** stop the check: invalid JSON, an unknown type or key (often a typo), wrong value types, `requiredQuestions` past the last question, Stroop codes missing from `colors`/`words`, Go/No-Go icons that don't exist, `nback` ≥ `trials`, impossible multiplayer settings.
- **Warnings** mean the study runs, but probably not as intended: i18n keys missing from `en.json` (participants would see the key), trial counts that don't fit the total, duplicate view ids, missing images.
- **Notes** (`-- --notes`): keys that do nothing, and text without a Persian or Arabic version.

## Running a study

- **Prolific:** add `?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}` to the study link. These are saved with the responses.
- **Saving as participants go:** `"saveProgress": true` saves every page as soon as it is completed, in addition to the full submission at the end. Use it to see where people drop out, or to recover data if the final save fails. Check that your consent form allows keeping data from people who stop partway.
- **Balanced conditions:** link to `https://server.cut.social/assign?studies=studyA/en,studyB/en` (plus the Prolific parameters). Each arrival goes to the condition with the fewest participants, counting completions and recent starts, so dropouts free their slot. A returning participant keeps their condition. Counts: `https://server.cut.social/assign/status?studies=studyA/en,studyB/en`. The older `/randomize` links still pick at random.
- **Data:** responses are stored in MongoDB by the submission server, one document per participant, holding each view's settings next to its response, so the data describes itself. Multiplayer matches are stored in Firestore.

## Development

Node 20 (see `.nvmrc`).

```bash
npm install
npm start          # http://localhost:3000
npm test           # game rules and bots
npm run validate   # study files
npm run build
```

Pushing to `master` deploys to lens.cut.social through GitHub Actions. `CLAUDE.md` describes the code; `scripts/e2e/` has browser tests for the multiplayer games.

## Research

Development was funded by The New School and the Association for Psychological Science (APS). Research using this platform:

* Rad, M. S., Ansarinia, M., & Shafir, E. (2023). Temporary self-deprivation can impair cognitive control: Evidence from the Ramadan fast. *Personality and Social Psychology Bulletin*, 49(3), 415–428. https://doi.org/10.1177/01461672211070385
