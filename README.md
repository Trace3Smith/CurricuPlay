# CURRICUPLAY

**This week’s content. Ready to play.**

React + Vite + TypeScript, client-side classroom games. Jeopardy consumes the shared local question engine. No accounts, database, live generation or student submissions.

## Current content status

The DCSS FY27 pacing guide has been imported: **755 subject-row records** (737 dated, 18 unresolved dates). The locally generated bank contains **108 drafts, 18 per grade K–5**. Generation uses the main guide for timing and explicitly cited instructional documents linked from its subject headers for lesson detail. It does not expand codes using outside knowledge.

**All drafts await teacher review and are excluded from gameplay until approved.** Each grade currently has fewer than the 30 distinct questions needed for a full board. Recent Content has additional gaps. See [the import report](content/reports/IMPORT_REPORT.md), [question review worksheet](content/reports/question-review.csv), and [curriculum review inventory](content/reports/curriculum-review.csv). This is not yet a fully populated classroom-ready bank.

## Run

Node.js 22.12+ is required; tested with Node 24. Python 3 is used only for offline content scripts.

```bash
cd /home/trace3smith/curricuplay/CurricuPlay
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. Keep the local server running. Use one browser tab per game and the same browser/URL each class to retain localStorage. No internet is needed for installed, locally served gameplay.

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

The production preview is http://localhost:4173, a separate storage origin. `dist/` can be hosted by a static web server; do not open its HTML as a filesystem URL. There is no service worker for offline reloads without a running server.

## Offline content workflow

- `content/sources/`: complete workbook text snapshot, source cell values/links and linked district documents. These source snapshots are outside the application bundle. The source spreadsheet is read-only.
- `content/question-drafts.json`: authored question groups, exact supporting quotes and explicit timing mappings. This is an editorial input, not a runtime AI generator.
- `scripts/ingest-content.py`: deterministic conversion into `src/data/curriculum.json` and `src/data/questions.json`. It makes no network or AI calls. The question-generation cutoff is explicitly recorded as September 13, 2026.
- `scripts/validate-content.py`: structural, source text/provenance, dates, ID, duplication, length and coverage checks.
- `scripts/report-content.py`: regenerates the human-readable report and review worksheets.

```bash
npm run content:import
npm run content:validate
python3 scripts/report-content.py
```

**Import resets generated questions to pending review.** Edit draft inputs before regeneration, not just generated output. After reviewing a question against its cited sources and its difficulty/age appropriateness, set that question’s `reviewStatus` to `approved` in `src/data/questions.json`. Leave unresolved questions `pending`. Approvals are a local data edit; no dashboard is needed. Rebuild production after edits and reset the current game if its bank changed.

Keep question IDs unique. Required fields include `id`, grade string (`K`, `1`–`5`), subject (`Literacy`, `Math`, `Science`, `Social Studies`), numeric difficulty (`1`–`3`), `question`, `answer`, `standard`, `weekIntroduced`, and `source`. Generated records also retain `curriculumId`, `curriculumIds`, `alignedWeeks`, `evidence`, `reviewStatus` and source URLs. Standards may be null when the source only supports an identified session; do not invent a standard to fill the field. `standardSource` distinguishes primary-sheet codes from explicitly stated linked-document codes.

`teacherSetup` names any required class map, sample, word wall, or observation record. Teacher-check responses intentionally give an assessment rubric. Review these dependencies before class. Keep prompts ≤240 characters and answers ≤300; K/1 prompts should stay short and teacher-readable.

Curriculum records preserve exact source cells plus grade, subject, instructional week, source Week of label, normalized date, quarter, raw standard/unit/session references, source location and unresolved-status flags. Month/day dates are normalized using the explicit 2026–2027 school-year context. Undated rows remain null, and future planned curriculum stays future.

## Classroom controls

Home → Jeopardy → grade → range → Start Game. Start is enabled only when approved questions are available.

- **Recent Content:** the selected date’s calendar week and the preceding week. Questions can match explicitly reviewed recurring `alignedWeeks`, while their original introduction date is preserved. The app does not infer holidays or fill missing lessons.
- **Everything Taught So Far:** eligible content introduced/aligned on or before the selected date. Both ranges always exclude future dates relative to the device’s local date. Changing content dates happens in setup; reset preserves the chosen date.
- **Review:** draws from the same eligible question bank and used-ID set. It adds no duplicate question records.
- The board offers two tiles at each of 1, 2, and 3 points per category, for 30 total. Missing/exhausted pools disable tiles. Actual duration depends on available questions and teacher pacing.
- Open a tile → students answer outside the app → Reveal Answer → Back to Board. Used IDs and tiles are saved when opened.
- **Reset Game:** confirmation clears used questions/tiles and the open question; preserves grade, range and date. Previously used questions can appear in the new game. Cancel preserves progress.
- **Change Grade:** confirmation ends the game and opens setup.
- **Home:** preserves the game; Jeopardy / Continue resumes it.
- Refresh restores progress and answer-reveal state, except a question that has been removed or returned to pending review is no longer restored.
- **Full Screen:** browser full-screen mode; F11 is an alternative. Designed for 1920 × 1080 landscape.
- K displays “TEACHER READS QUESTION ALOUD”; grade 1 displays “TEACHER MAY READ QUESTION ALOUD”. Teacher preparation notes appear when required.
- localStorage key: `curricuplay.game.v1`. Corrupt saves recover safely; storage failures show a warning. Clearing browser data removes progress.

## Architecture and tests

`src/services/curriculumService.ts` supplies date/range filtering and curriculum lookup. `src/services/questionEngine.ts` supplies shared validation, filtering, randomization and used-ID tracking. `src/games/jeopardy/board.ts` defines the board; academic content stays in data. Offline ingestion scripts are never called by gameplay.

```bash
npx playwright install chromium
npm test -- --workers=2
npm run build
```

The original synthetic flow tests remain. Additional tests render and reveal every generated question at 1920 × 1080, verify no repeats, verify pending content cannot play, and check real curriculum/date filtering. Approval is simulated only through intercepted browser responses; production drafts remain pending. See [VERIFICATION.md](VERIFICATION.md).

Only Jeopardy is implemented. Other game cards are placeholders. Optional Learning Information remains deferred.
