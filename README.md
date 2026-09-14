# CURRICUPLAY

**This week’s content. Ready to play.**

React + Vite + TypeScript, client-side classroom games. Jeopardy consumes the shared local question engine. No accounts, database, live generation or student submissions.

## Current content status

The DCSS FY27 pacing guide has been imported: **755 subject-row records** (737 dated, 18 unresolved dates). The locally generated bank contains **216 drafts, 36 per grade K–5**. Generation uses the main guide for timing and explicitly cited instructional documents linked from its subject headers for lesson detail. It does not expand codes using outside knowledge.

**All drafts await teacher review and are excluded from gameplay until approved.** K and grade 1 retain 36 self-contained drafts each. Grades 2–5 have material-related category gaps and cannot currently launch a full board, even if all safe drafts are approved. The start check now reserves 30 unique questions across all tiles, so Review-first play cannot exhaust other categories. Each grade is still 24 drafts below the 60-question target even before approval. Recent Content has additional gaps. See [the import report](content/reports/IMPORT_REPORT.md), [question review worksheet](content/reports/question-review.csv), and [curriculum review inventory](content/reports/curriculum-review.csv). This is not yet a fully populated classroom-ready bank.

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

## Self-contained gameplay rule

A normal CurricuPlay question must display everything needed to answer it. Teacher reading and verbal explanations are allowed. Referencing a chart, map, worksheet, textbook, word wall, teacher-created display, or physical lesson material outside CurricuPlay is not.

All 216 records were audited. 49 had explicit preparation requirements; 7 more depended on unstated classroom/learner context or drawing materials. 37 were replaced in place with self-contained practice prompts. 19 remain excluded because the inspected evidence was insufficient for a safe replacement. Self-contained totals: K 36, grade 1 36, grade 2 34, grade 3 30, grade 4 30, grade 5 31. These are content-eligible drafts, not automatic approvals.

The audit and all original questions are retained in `content/material-audit.json`; the importer validates its original snapshot before applying any replacement or material flag. Missing/stale audits fail import. Source evidence, standards, grade, difficulty, and instructional dates are preserved. Previous decisions are compared against their saved source snapshots. Only additions of the self-contained flag (`false`) and the standard harmless audit note can preserve a decision, and only when the previously reviewed question and answer exactly match the current text. All other changes require review; previous rejections remain excluded. Saved snapshots and review timestamps are not rewritten. Detailed results: [material audit report](content/reports/MATERIAL_AUDIT_REPORT.md).

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

### Teacher Question Review

Open **Home → Teacher tools · Question Review**. Filter by grade, subject, point difficulty, or review status. Review one draft at a time, with its exact source evidence, instructional dates, standard/session, teacher preparation needs, and pacing warnings. Expand the source-row notes for incomplete or ambiguous pacing details.

Edit Question and Answer if needed, then choose **Edit & Approve**. For unchanged wording choose **Approve**; otherwise choose **Needs Review**, or **Reject**. Every decision saves the displayed wording locally. Approve enables the question for gameplay within the normal date/range filters. Needs Review and Reject exclude it. Navigation warns before discarding unsaved edits; approval requires nonblank text within Smart Board length limits. K–1 prompts over 30 words display a reading-level warning. The screen shows approved/generated/60-target progress for every grade and overall approval, pending, needs-review, and rejected counts. No drafts are automatically approved.

Reviews use `curricuplay.reviews.v1`, separately from game progress. Reset Game and Change Grade retain reviews. Refresh retains saved decisions and edits; it does not retain unsaved text or review filters. Clearing browser data removes reviews. Reviews do not sync to another browser, device, or URL/port. There is no export or publication step yet, so review in the same browser and URL used for class. Source JSON stays unchanged.

**Import writes generated questions as pending.** Edit draft inputs before regeneration, not just generated output. Local reviews remain valid when the source record is unchanged, or through the narrow material-audit metadata exception described above. Changes to wording, alignment, subject, difficulty, timing, evidence, or other metadata cannot inherit approval. A rejected record remains rejected even if a replacement requires attention. Approval never changes dates, source evidence, or unresolved curriculum mappings. The review screen is an internal teacher tool, not an access-controlled account area.

Keep question IDs unique. Required fields include `id`, grade string (`K`, `1`–`5`), subject (`Literacy`, `Math`, `Science`, `Social Studies`), numeric difficulty (`1`–`3`), `question`, `answer`, `standard`, `weekIntroduced`, and `source`. Generated records also retain `curriculumId`, `curriculumIds`, `alignedWeeks`, `evidence`, `reviewStatus` and source URLs. Standards may be null when the source only supports an identified session; do not invent a standard to fill the field. `standardSource` distinguishes primary-sheet codes from explicitly stated linked-document codes.

`requiresExternalClassroomMaterial` is a required boolean. Normal gameplay accepts only explicit `false`; missing/true flags are excluded, even for approved questions. `teacherSetup` is retained for excluded drafts. Teacher-check responses remain allowed when the prompt and rubric are self-contained. Approval of edited wording requires confirmation that no external reference was introduced. Keep prompts ≤240 characters and answers ≤300; K/1 prompts should stay short and teacher-readable.

Curriculum records preserve exact source cells plus grade, subject, instructional week, source Week of label, normalized date, quarter, raw standard/unit/session references, source location and unresolved-status flags. Month/day dates are normalized using the explicit 2026–2027 school-year context. Undated rows remain null, and future planned curriculum stays future.

## First-grade classroom trial

Open **http://localhost:5173/#review** (or use the Question Review link in the Home/setup header). The direct link selects **1st Grade**. The Grade filter can select another grade; All review status shows the complete 36-draft grade queue. Use **Jump to a draft**, or enable **Advance to next question after saving a decision** for one-action review. No automatic approvals are made.

Each question displays source quotations and links, instructional dates, standard/session references, and prominent teacher-check/materials/word-wall/pacing caveats. External-resource questions are excluded from gameplay even if approved. Use the Gameplay materials filter to separate them from self-contained prompts. Teacher reading is allowed.

The **Classroom trial readiness** panel defaults to Everything Taught So Far and today's date. It counts eligible local approvals and verifies unique assignments to all 30 tiles. Approve a balanced set, then click **Start 30-tile classroom trial** once the panel reports **30/30 tiles covered**. A balanced set of exactly 30 can work; 30 arbitrary approvals may not. First-grade Recent Content currently lacks Social Studies coverage and remains blocked. The bank has not been expanded beyond 36 drafts per grade.

A new game reserves randomized questions before play, so Review cannot take a question needed by another tile. Reset creates a new complete assignment while retaining local reviews. Keep the same browser and origin (`localhost` and `127.0.0.1`, or different ports, have separate localStorage).

## Classroom controls

Home → Jeopardy → grade → range → Start Game. Start is enabled only when all 30 tiles can be assigned distinct eligible approved questions. A total of 30 approvals alone does not guarantee category/difficulty coverage.

- **Recent Content:** the selected date’s calendar week and the preceding week. Questions can match explicitly reviewed recurring `alignedWeeks`, while their original introduction date is preserved. The app does not infer holidays or fill missing lessons.
- **Everything Taught So Far:** eligible content introduced/aligned on or before the selected date. Both ranges always exclude future dates relative to the device’s local date. Changing content dates happens in setup; reset preserves the chosen date.
- **Review:** draws from the same eligible question bank and used-ID set. It adds no duplicate question records.
- **Coverage requirement:** at least 30 eligible unique questions per grade and selected range to complete a game; target **at least 60 approved questions per grade** for variation between classes. 60 is a target, not a generation cap. Each category/difficulty needs two questions, with enough distinct questions left for Review after subject play. Review overlaps the subject pools and must never inflate unique totals. Prioritize supported evidence over quotas; report shortages instead of inventing content. The offline validation report includes minimum/target deficits by grade and range and undersupplied category/difficulty pools. Its approval counts reflect source JSON, not browser-local review decisions.
- The board offers two tiles at each of 1, 2, and 3 points per category, for 30 total. Missing/exhausted pools disable tiles. Actual duration depends on available questions and teacher pacing.
- Open a tile → students answer outside the app → Reveal Answer → Back to Board. Thirty randomized unique question assignments are reserved at launch and persisted; used IDs and tiles are saved when opened. The shared engine matches overlapping pools so any tile order, including Review first, can finish.
- **Reset Game:** confirmation clears used questions/tiles and the open question; preserves grade, range and date. Previously used questions can appear in the new game. Cancel preserves progress.
- **Change Grade:** confirmation ends the game and opens setup.
- **Home:** preserves the game; Jeopardy / Continue resumes it.
- Refresh restores reserved questions, progress and answer-reveal state. If a reserved question becomes ineligible, the saved board returns to setup for a new check; an open board is paused if approvals change. No pending/rejected replacement is silently used.
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

The original synthetic flow tests remain. Additional tests render and reveal every generated question at 1920 × 1080, verify no repeats, verify pending content cannot play, and check real curriculum/date filtering. Tests simulate approval in isolated test browsers (via local review or intercepted responses); production drafts remain pending. See [VERIFICATION.md](VERIFICATION.md).

Only Jeopardy is implemented. Other game cards are placeholders. Optional Learning Information remains deferred.

### Review reconciliation

Open `http://localhost:5173/#review` for first grade with **Only questions needing attention** selected. The Changes since human review filter also separates metadata-only records, changed content, replacements, current decisions, and missing prior decisions. The summary uses this browser’s saved human decisions; Copy review summary copies the exact counts. Selecting Only questions needing attention clears other filters except grade. Approving a queued draft removes it without skipping the next draft. No human decision is inferred when browser storage is missing.

The original first-grade source comparison is **30 metadata-only / 0 other substantive changes / 6 replacements**. These are source-change counts, not counts of human approvals. Prior locally edited wording that differs from today’s question/answer also requires re-review.

### First-grade quality correction

Five pretend-location replacements have been withdrawn. First grade now has 31 active self-contained drafts and only 25/30 possible board tiles even after full approval; launch remains blocked by the Social Studies shortage. The dot prompt now uses an everyday apple addition problem and requires review. Other first-grade wording is unchanged. See [quality report](content/reports/FIRST_GRADE_QUALITY_REPORT.md) for evidence, withdrawn IDs and the authentic-content rule. This supersedes the earlier 36-draft/full-board and six-replacement counts.

### Tomorrow Classroom Pack (current gameplay source)

Normal gameplay uses the separate **DCSS Tomorrow Classroom Pack - 2026-09-14** in `src/data/tomorrow-pack.json`, with a September 13 cutoff. Select Everything Taught So Far. K, 2, 4 and 5 have complete boards; grades 1 and 3 remain blocked by Social Studies shortages. Pack acceptance is automated/editorial, not human approval. The ingestion system, 755 curriculum records, 211 pending drafts and browser-local reviews remain separate. Teacher Tools still launches approved draft trials through the shared engine.

Run `npm run content:tomorrow` to validate/rebuild. See [release report](content/reports/TOMORROW_PACK_REPORT.md) and [five examples per grade](content/reports/TOMORROW_SPOT_CHECK.md). Earlier totals/readiness statements describe prior checkpoints.
