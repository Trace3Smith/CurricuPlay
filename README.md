# CURRICUPLAY

**This week’s content. Ready to play.**

Client-only React + Vite + TypeScript classroom quiz platform. Jeopardy is the only playable game. No accounts, backend, AI calls, or student submissions.

## Current readiness

The software flow is implemented. **Classroom content is pending:** the DCSS FY27 K–5 pacing guide and verified question bank have not yet been supplied. Both JSON data files intentionally contain empty arrays. Start Game stays disabled until suitable questions exist. No standards, mappings, or academic questions have been invented. Synthetic browser-test fixtures are isolated in `tests/` and never ship in the app.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```bash
cd /home/trace3smith/curricuplay/CurricuPlay
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. Dependencies are already installed in this workspace. Keep the server running. Use the same URL and browser each class so localStorage stays consistent. Use one tab per game.

For a production build:

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Open http://localhost:4173. This is a separate localStorage origin from port 5173. The generated `dist/` can also be served by any static web server; opening `index.html` directly as a file is not supported. No internet is needed for gameplay once installed and served locally. Offline reload without a running local server is not supported.

## Add approved content

1. Replace the empty array in `src/data/questions.json` with the verified bank, normalized to the schema in `src/types/index.ts`.
2. Populate `src/data/curriculum.json` from the pacing guide itself. Preserve source attribution. Do not infer dates or standards where the source is ambiguous.
3. Use unique question IDs, grade strings `K`, `1`–`5`, subjects `Literacy`, `Math`, `Science`, `Social Studies`, and numeric difficulty `1`, `2`, or `3`. Each question requires nonempty `question`, `answer`, `standard`, `source` and a valid `weekIntroduced` date (`YYYY-MM-DD`). Standard and source must be taken from the supplied verified material.
4. Optional fields: `questionType`, `choices` (up to four short strings), `teacherRead`, `reviewQuestion`. Answers should include an understandable response, not just a choice letter. The app adds A/B/C/D labels to choices.
5. Keep K/1 questions short and suitable for reading aloud. Preview every unusually long prompt/answer on the classroom display: automatic unlimited-text fitting is not implemented.
6. Save the file. Vite reloads in development; rebuild for production. Reset any existing game after changing the bank. Invalid records or duplicate IDs disable the entire bank with an error, rather than quietly mixing valid and invalid content.

The curriculum entry shape supports `grade`, `weekOf`, `source`, `literacy` (unit, sessions, standards), `math` and `science` (standard or standards), and `socialStudies` (standards). See `src/types/index.ts`. Question eligibility currently uses the verified `weekIntroduced` metadata; the app does not parse a pacing-guide PDF or automatically verify its standards against the bank.

## Classroom controls

- Home → Jeopardy → grade → content range → Start Game.
- **Recent Content:** the Monday of the selected date’s week and the previous instructional calendar week, through the selected date. It does not infer district holiday schedules.
- **Everything Taught So Far:** all bank questions introduced on or before the selected date. Neither range includes future dates relative to the device’s local date. The content date remains fixed across refresh/reset; change it in setup for a later teaching day.
- Each category has two opportunities at each point value, for 30 tiles total. Duration depends on discussion and teacher pacing. Full coverage requires enough eligible questions: at least 30 distinct questions per grade/range, with sufficient questions in every category/difficulty pool, including Review overlap.
- **Review:** eligible questions explicitly marked `reviewQuestion: true`, or content introduced before the two-week recent window. Recent range still applies, so recent Review needs explicitly marked questions. Review draws from the same used-ID tracker as other categories.
- Select a tile, let students respond outside the app, Reveal Answer, then Back to Board. No scorekeeping is included.
- A question and tile are marked used immediately when opened. A refresh or Home → Continue returns to the same question and reveal state. Used and exhausted tiles cannot be selected.
- **Reset Game:** confirm to clear all used IDs/tiles and the current question. Grade, range, and content date stay selected. Previously seen questions can appear in this new game. Cancel preserves the game.
- **Change Grade:** confirm to end the current game and open setup. Pick the grade and/or range, then Start Game.
- **Home:** preserves the current game. Select Jeopardy / Continue to resume.
- **Full Screen:** uses the browser full-screen control; F11 is an alternative. Designed primarily for 1920 × 1080 landscape.
- Kindergarten displays “TEACHER READS QUESTION ALOUD”; grade 1 displays “TEACHER MAY READ QUESTION ALOUD”.
- State is versioned in localStorage under `curricuplay.game.v1`. Storage failures display a warning; malformed saved data falls back to Home safely. Clearing browser data removes progress.

## Structure

- `src/data/`: approved questions and pacing-guide mappings
- `src/services/curriculumService.ts`: date/range filtering and curriculum lookup
- `src/services/questionEngine.ts`: validation, filtering, random selection and used-ID tracking
- `src/games/jeopardy/`: game board definition
- `src/App.tsx`: setup, navigation and game rendering
- `src/utils/storage.ts`: defensive loading and saving
- `tests/`: synthetic browser fixtures and end-to-end verification

Other games can consume `createQuestionEngine()` without embedding academic content. The engine exposes `getQuestions`, `getRandomQuestion`, `markQuestionUsed`, `isQuestionUsed`, `getAvailableQuestionCount`, and `resetUsedQuestions`.

## Verification

```bash
npx playwright install chromium
npm test -- --workers=2
npm run build
```

Tests exercise all six grades across 30-tile games, category/value selection, randomization, no repeats across Review and subject pools, reveal, reset/cancel, Home/resume, Change Grade, refresh, date ranges, future exclusion, empty/exhausted pools, invalid question data, storage failures and 1920 × 1080 geometry. Screenshots are written to `test-results/`. Test data is supplied through intercepted browser module requests, not production data files.

Content accuracy, actual K–5 coverage, prompt-length fitting with the real bank, and the district’s exact week mappings still require the supplied files and a final content-backed test. Optional Learning Information was deferred. No second game has been built.
