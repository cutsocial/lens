# Lens: A Study Viewer

Lens is the evolution of [Cut](https://cut.social/), a platform that facilitates rapid development and deployment of interactive research instruments. Examples include:

* [2-Alternative-Forced-Choice Task](https://lens.cut.social/#/gonogo/en)
* [Balloon Analogue Risk Task (BART)](https://lens.cut.social/#/bart/en)
* [Stroop Task](https://lens.cut.social/#/stroop/en)
* [Ultimatum Game](https://lens.cut.social/#/ultimatum/en)
* [Dictator Game](https://lens.cut.social/#/dictator/en)
* [Task Switch](https://lens.cut.social/#/taskswitch/en)
* [Go/NoGo](https://lens.cut.social/#/gonogoalt/en)
* [N-back](https://lens.cut.social/#/nback/en)

## Experiment Types

Lens supports the following experiment and question types:

### Interactive Tasks
- **`bart`** - Balloon Analogue Risk Task: Measures risk-taking behavior through a balloon pumping game
- **`gonogo`** - Go/NoGo Task: Response inhibition task with go and no-go stimuli
- **`gonogoalt`** - Alternative Go/NoGo Task: Variant with different stimulus configurations
- **`stroop`** - Stroop Task: Cognitive interference task measuring selective attention
- **`taskswitch`** - Task Switching: Measures cognitive flexibility by switching between tasks
- **`simplified_taskswitch`** - Simplified Task Switching: Streamlined version of task switching
- **`nback`** - N-back Task: Working memory task requiring participants to recall previous stimuli
- **`ultimatum`** - Ultimatum Game: Economic game measuring fairness and negotiation behavior
- **`dictator`** - Dictator Game: Economic game measuring altruism and fairness

### Lens 2 tasks (new design, same data)

- `stroop2`: Stroop in the Lens 2 design. Same study-file options and data fields as `stroop`, plus `taskVersion: 2` in the response. Optional `"showFixation": true` shows a "+" during the fixation interval (classic leaves it blank). Demo: `/#/demo-lens2/en`.
- `gonogoalt2`: letter/icon Go/No-Go in the Lens 2 design. Same options and data as `gonogoalt`; tap anywhere on the stage or press Space.
- `nback2`: N-back in the Lens 2 design. Same options and data as `nback`; responses during the first `nback` trials are refused, as in classic.
- `bart2`: BART in the Lens 2 design. Same options and data as `bart`. Optional `"ballScale"` (default 1) enlarges the balloon; `"stimulusStyle": "lens2"` draws it as the solid orange ball from the Lens 2 design instead of the classic red bubble.
- `dictator2`, `ultimatum2`: token games in the Lens 2 design. Same options and data as `dictator`/`ultimatum`. Optional `"tapControls": true` adds +/− buttons; dictator's `"matchmakingDelay"` (ms, default 5000) sets the "finding another person" wait.
- All Lens 2 tasks accept an optional `"startText"` (an i18n key) for the start screen.

### Survey Elements
- **`text`** - Text display and input: Supports instruction pages, text questions, and autocomplete fields
- **`matrix`** - Matrix questions: Multiple choice questions with various configurations (slider, vertical/horizontal, single/multiple questions)
- **`prolific`** - Prolific integration: Specialized view for Prolific participant management

## Getting Started

### Prerequisites

- Node.js 20 or newer (see `.nvmrc`)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lens
```

2. Install dependencies:
```bash
npm install
```

### Running the Development Server

Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000` in your browser.

### Building for Production

Create a production build:
```bash
npm run build
```

Deploy to GitHub Pages:
```bash
npm run deploy
```

## Using Experiments

### Accessing Experiments

Experiments are accessed via URL in the format:
```
/#/{studyId}/{language}
```

Where:
- `studyId` is the name of the JSON file in `public/experiments/` (without the `.json` extension)
- `language` is the language code (e.g., `en`, `fa`, `ar`)

Examples:
- `/#/bart/en` - BART experiment in English
- `/#/dictator/fa` - Dictator game in Farsi
- `/#/demo-comprehensive/en` - Comprehensive demo with all experiment types

### Creating Experiments

1. Create a JSON file in `public/experiments/` following the experiment schema
2. The JSON file should include:
   - `studyId`: Unique identifier for the study
   - `condition`: Condition/variant identifier
   - `redirectTo`: URL to redirect after completion
   - `submissionNote`: Translation key for submission message
   - `metadata`: Study metadata (e.g., maintainer email)
   - `fontScale` (optional): Text size on survey pages, e.g. `1.2` for 20% larger. Interactive tasks are never scaled, so stimulus sizes stay as designed. Default `1`.
   - `views`: Array of experiment views/tasks

3. See `public/experiments/demo-comprehensive.json` for a comprehensive example with all experiment types

### Experiment Configuration

Each view in the `views` array can be one of the supported types. Views are executed sequentially, and responses are collected automatically. Interactive tasks (like `bart`, `gonogo`, etc.) handle their own navigation, while survey elements use the standard navigation buttons.

## Architecture

Lens uses React and Material UI to structure the development process while simplifying the study design for experimenters and providing a streamlined experience to respondents. It works by sending users a JSON file containing the tasks and questions and collecting their responses in the same format. See the details [here](https://sites.google.com/view/msrad/cut?authuser=0).

This architecture provides several other functionalities, in addition to facilitating the integration of interactive tasks with conventional survey elements:

* Multilingual survey content with minimal effort
* Device adaptive research instruments
* Markdown text formatting

## Research

We obtained funding from the New School and the Association for Psychological Science (APS) to develop this tool. Research using this platform has been published in the *Journal Personality and Social Psychology Bulletin*:

* Rad, M. S., Ansarinia, M., & Shafir, E. (2023). Temporary self-deprivation can impair cognitive control: evidence from the Ramadan fast. Personality and social psychology bulletin, 49(3), 415-428. https://journals.sagepub.com/doi/full/10.1177/01461672211070385

