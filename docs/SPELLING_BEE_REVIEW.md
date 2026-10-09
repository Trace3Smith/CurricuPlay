# Spelling Bee MVP — local review

Branch: `classthread-spelling-bee`. No commit, push, merge, migration, or deployment.

Try: http://127.0.0.1:5173/games/spelling-bee

## Classroom use

1. Choose a grade, word bank, and hint level. The sample bank has five words per grade (30 total). Choose “Teacher: preview word list” when preparing physical letters, including duplicate letters needed within a word, for six teams. This preview stays collapsed until the teacher opens it.
2. Teams are Orange, Purple, Green, Yellow, Red, Blue. All teams solve the same word; they can write it or build it with tiles. Optional PE directions are in a collapsed teacher-notes section, not on the live game screen.
3. Read the clue aloud. `Speak Clue` and `Say Word` are optional browser speech controls. Younger learners can say and blend letter sounds. Hint levels show all but the middle letter, 1–3 anchor letters based on word length, or no letters. In the middle setting, 2–5 letters get the beginning letter, 6–9 get the beginning/end, and 10–16 get the beginning pair/end. “Reveal Another Letter” splits the largest unrevealed gap, using stable left-to-right tie breaking. Added hints survive refresh and remain when the dropdown changes; they reset on the next word. One middle letter always remains hidden until the teacher reveals the full answer. Single-letter words always remain hidden until reveal.
4. Select every team that correctly finished. Selections remain drafts until `Commit Results`. Committing records six responses: selected teams receive one point, all others receive zero. Only commit after observing all teams.
5. `Teacher: Reveal Answer` is independent of scoring. The written answer stays hidden until selected. `Say Word` deliberately speaks the target without revealing its written spelling.
6. `Next Word` is enabled after committing. It resets selections and reveal state. Words are shuffled once and never repeat in a session. `Finish Game` follows the final word. `End Game` confirms that uncommitted work will not count.
7. The summary shows committed team accuracy, six scores, and paginated word results. It explicitly excludes individual mastery claims. Completed reports are available from Spelling Bee History.

## Custom lists

Paste plain words separated by commas/newlines, or one structured entry per line:

```text
cat | A pet that says meow. | CVC short a | cat | My teacher-prepared lesson
sun | It shines in the daytime sky. | CVC short u | sun
```

Fields: word, clue, spelling/phonics skill, picture ID, source. Grade is the selected grade. The review checkbox approves classroom use; drafts can be saved but cannot play. Saved lists can be reused or edited as a copy, preserving the original. Blank clue fields use a teacher-read/audio instruction. Lists are limited to 200 words, each 1–16 ASCII English letters. Duplicate words are rejected case-insensitively. Invalid input fails closed with row-level errors. Mixed-grade saved records are supported by the schema; the editor creates one grade at a time.

## Content provenance and image review

`src/data/spelling-bee.json` contains **general sample practice, not district pacing-guide vocabulary**. No district spelling list or current/previously taught designation is inferred. Local pacing and linked literacy snapshots were inspected, including `content/sources/README.md`, `pacing-guide-export.txt`, `linked-k-literacy.json`, and `linked-1-literacy.json`. They contain vocabulary but also conflicting unit/calendar dates; the MVP does not assert a verified district spelling sequence. Curriculum integration needs explicit word-level evidence, grade/scope review, and reliable timing before addition.

Sample clues and skills were editorially checked for simple definitions, spelling patterns, grade suitability, and answer leakage. These are practice suggestions; the teacher should check suitability for their learners.

Approved local picture references:

- `cat`: new simple SVG illustration; pointed ears, whiskers and curled tail; no printed answer.
- `sun`: new simple SVG illustration; circle with rays; no printed answer.
- `plant`: existing Four Corners illustration; roots, stem, leaves and flower. Its printed “Soil” label does not expose the target word “plant”.
- `leaf`: existing Four Corners illustration; arrow indicates a leaf, not another plant part. Its printed “Soil” label does not expose “leaf”.

- `sit`: side-view child seated on a chair, with bent knees and feet on the floor.
- `map`: folded map with roads, river, route and destination, without a printed answer.
- `ship`: large multi-deck vessel with windows/portholes on water.
- `cake`: round frosted birthday cake with candles and a plate.
- `night`: dark sky, crescent moon, stars and houses.
- `rain`: visible drops falling from a cloud into a puddle.

The six new SVG pictures were visually reviewed in the actual 1920×1080 game screens. Picture support now covers 11 of the 15 K–2 sample entries. The words “the”, “this”, “because” and “wish” retain sentence/definition clues without ambiguous decorative images. The custom-list editor derives available picture IDs from the registry so all ten approved references can be reused.

Images are allowlisted local assets with descriptive alternatives. Arbitrary external/unreviewed image URLs cannot enter a playable list. Missing pictures fall back to the written/spoken clue. This small reviewed image collection does not cover every word.

## Architecture and preservation

Inspected `src/App.tsx`, Games routing, Jeopardy board/question engine, Four Corners engine/teams/timer, assessment engine/history, browser recovery, and the legacy preservation/export boundary before implementing.

Spelling Bee routes beside the legacy App, so opening it directly does not mount Jeopardy's save effects. It reuses `createSession`, `commitQuestion`, `endSession`, `summarizeSession`, `formatAccuracy`, `isGameSession`, and the existing six team presets. The legacy question engine remains unchanged; spelling has its own validation and immutable session snapshots because its entry structure and teacher lists differ from curriculum questions.

Separate versioned browser keys:

- `classthread.spelling-bee.active.v1`
- `classthread.spelling-bee.lists.v1`
- `classthread.spelling-bee.history.v1`

Recovery validates entry structure, unique IDs/words, grade, queue position, team identity, scores, committed response counts and snapshot consistency. Corrupt data remains untouched. Write errors remain visible with a retry control; new-game clearing is blocked until the completed report saves. Histories use idempotent session IDs. Draft selections and reveal state survive refresh and leaving Games. Browser storage is local to the origin/browser. Use one teacher tab for scoring; other tabs receive storage change notifications.

Existing Jeopardy/Four Corners storage, timers, question banks, assessment history, legacy backup format, and teacher foundation are unchanged. Spelling Bee storage is intentionally separate from the legacy Games export. No database or API changes.

## Files

New:

- `src/games/spelling-bee/SpellingBee.tsx` — gameplay, teacher controls, recovery warnings, summaries/history.
- `src/games/spelling-bee/WordBank.tsx` — setup and custom-list editor.
- `src/games/spelling-bee/engine.ts` — immutable gameplay and score transitions, recovery validation.
- `src/games/spelling-bee/words.ts` — schema, import parser, hint logic, picture registry.
- `src/games/spelling-bee/storage.ts` — isolated active/list/history persistence.
- `src/games/spelling-bee/spelling-bee.css` — Smart Board and responsive layout.
- `src/data/spelling-bee.json` — 30 labeled sample words.
- `public/spelling-bee/{cat,sun,sit,map,ship,cake,night,rain}.svg` — local clue illustrations.
- `tests/spelling-bee-engine.spec.ts`, `tests/spelling-bee.spec.ts` — validation, scoring, persistence, browser, keyboard/touch, and viewport tests.
- `scripts/validate-spelling-bee.py` — read-only sample/content/image validator.
- `docs/SPELLING_BEE_REVIEW.md` — this review and usage guide.

Modified:

- `src/App.tsx` — third game card with Play/Continue detection.
- `src/app/LegacyGamesRoute.tsx` — `/games/spelling-bee` routing.
- `src/styles.css` — three-column Games card layout.
- `package.json` — dedicated spelling content-validation command.
- `tsconfig.json` — includes the new tests in TypeScript checking.

## Validation

Completed October 8, 2026:

- Full Playwright regression suite: **199 passed**, including all existing tests and 22 new Spelling Bee tests (`npx playwright test --workers=4 --reporter=line`).
- After the final collapsed teacher-preview adjustment, all **22 Spelling Bee tests passed again** (`npx playwright test tests/spelling-bee-engine.spec.ts tests/spelling-bee.spec.ts --workers=2 --reporter=line`).
- `npm run typecheck`: passed, including the new tests.
- `npm run build`: passed. Vite reports dependency directive/annotation warnings and a large Games bundle warning; these are non-fatal.
- `npm run content:validate`: passed with no errors or warnings.
- `python3 scripts/validate-four-corners.py`: passed with no errors.
- `npm run content:validate:spelling-bee`: passed; 30 sample words, six grades, four local pictures at the initial MVP verification (now ten after refinement).
- `git diff --check`: passed.
- 1920×1080 checks cover the Games landing, setup/editor, every sample round for every grade, hidden/revealed states, scoring controls, summaries, and a 16-letter custom word with a long clue. No page scrolling or clipped controls in those checks.
- Accessibility checks cover accessible field/control names, blank-slot labels, keyboard selection, modal focus/Escape, 44px minimum touch targets, and a 390px responsive layout.
- Complete Kindergarten and Grade 5 browser walkthroughs were performed using Chromium/Playwright, with manual screenshot review of setup, landing, picture clues, long-word slots, reveal and summary. Each walkthrough exercised all five words, varied correct-team selections, leaving/continuing, refresh recovery and report pagination. Each finished with Orange 5, Blue 3, other teams 0, and 26.7% (8/30) committed accuracy. No browser errors. This is browser-based verification, not an in-person scooter/Smart Board trial.
- New tests additionally cover duplicate commits, no repeats, early ending, corrupt/unavailable storage, preservation of old game/timer/history records, saved draft approval/reuse, optional speech dispatch, and failed-image recovery.

Local verification logs: `/tmp/spelling-bee-regression-final.log`, `/tmp/spelling-bee-final-focused.log`, `/tmp/spelling-bee-build.log`. Walkthrough screenshots: `/tmp/spelling-bee-review/`. Test screenshots are under `test-results/`. These local artifacts are not committed.

## MVP limits

- No claimed district vocabulary alignment; current/previously taught curriculum pools await verified evidence and timing.
- Five sample words per grade; teachers can prepare longer custom lists.
- English A–Z words only; no spaces, punctuation, hyphens or accents.
- Ten reviewed image references. Teachers cannot upload images in this increment.
- Browser-local saves, with no account/cloud sync or import/export UI for Spelling Bee. Keep browser data intact.
- Speech depends on browser/OS support and voice availability. Physical scooter operation and actual Smart Board audio require in-class verification.
- Mobile layouts allow vertical scrolling; the 1920×1080 classroom view fits without scrolling.
- Committed results are intentionally locked; selections can be corrected before commitment. This is team practice evidence, never individual mastery.


## Focused refinement after classroom review

Scope: no redesign, no new dependencies, no shared assessment or other-game changes. The PE banner was removed, setup instructions now support both writing and letter tiles, and PE rules are available only as optional teacher notes. Six matching illustrations were added and the clue-image area was enlarged modestly. All scoring, commit/reveal controls, grade selection, speech controls, routing and session history remain intact.

The optional `extraLetters` field is backwards compatible with existing v1 browser sessions. Recovery validates positions, uniqueness and the unrevealed final letter. Older sessions without that field still load. Already-saved sessions keep their word/clue/picture snapshots; start a new game to see the revised sample entries.

Full sample review:

| Grade | Words reviewed | Outcome |
| --- | --- | --- |
| K | cat, sun, map, sit, the | Retained CVC/sight-word mix. Map and sit now have direct, concrete clues and matching pictures. The sentence clue stays. |
| 1 | ship, plant, cake, this, sun | Added ship and cake pictures. Kept digraph, silent-e, blend and high-frequency practice, including “___ is my book, right here.” |
| 2 | leaf, rain, night, because, wish | Added rain/night pictures and clarified night. Kept vowel-team/igh practice and sentence/definition variety. Abstract words stay text/audio based. |
| 3 | habitat, compare, journey, gentle, replay | Retained familiar definitions and word-part practice; smoothed gentle’s wording. Medium words now receive two initial letters in the middle hint setting. |
| 4 | fraction, evidence, weather, predict, courage | Kept concise, accurate definitions and spelling skills. These are optional academic practice, not claimed district words. |
| 5 | photosynthesis, persuade, ecosystem, responsible, analyze | Kept photosynthesis as an optional stretch word with three initial letters and teacher-added hints. Clarified ecosystem/responsible definitions, corrected ecosystem’s skill to “Word part eco-”, and made analyze’s skill more descriptive. |

Refinement files: `SpellingBee.tsx`, `WordBank.tsx`, `words.ts`, `engine.ts`, `spelling-bee.css`, the sample JSON, six new SVGs, both Spelling Bee test files, the spelling validator, and this report. No changes to storage keys or existing stored snapshots.

Refinement validation results:

- Full regression: **203 passed** (including **26 Spelling Bee tests**), using `npx playwright test --workers=4 --reporter=line`.
- `npm run typecheck`, `npm run build`, `npm run content:validate`, `python3 scripts/validate-four-corners.py`, `npm run content:validate:spelling-bee`, and `git diff --check` all passed. Build retains the non-fatal dependency/bundle warnings noted above.
- All six grade flows fit 1920×1080, including enlarged pictures, the added hint button, revealed answers and summary screens. The existing mobile and keyboard checks pass.
- New tests verify length-based hint counts, deterministic incremental reveals, at least one hidden letter under every hint level, unchanged scores, refresh persistence, per-word reset, malformed hint rejection and compatibility with older sessions.
- Visually inspected all six new picture/clue pairings and the progressive PHOTOSYNTHESIS hint screen. New pictures load from local assets, have descriptive accessible names, and contain no printed target answers.
- Current logs: `/tmp/spelling-bee-refinement-regression.log`, `/tmp/spelling-bee-refinement-build.log`, `/tmp/spelling-bee-refinement-content.log`, `/tmp/spelling-bee-refinement-corners.log`, `/tmp/spelling-bee-refinement-bank.log`. Screenshots: `test-results/spelling-bee-visual-{sit,map,ship,cake,night,rain}.png` and `test-results/spelling-bee-incremental-hints.png`.

Remaining limits: vocabulary remains explicitly general practice without claimed district alignment. Hint scaling uses word length and teacher-selected support level, not an inferred student ability model or a full phonics/morphology dictionary. Physical classroom/PE implementation and browser voice quality remain teacher-controlled.
