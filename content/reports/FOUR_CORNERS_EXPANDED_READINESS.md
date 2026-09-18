> Historical report: superseded by [the September 17 question-and-choice quality audit](FOUR_CORNERS_QUALITY_AUDIT.md). Current bank: 264 questions; the original preservation and coverage claims below describe the earlier state.

# Four Corners expanded readiness — September 16, 2026

Branch: `four-corners-mvp`. Not pushed, merged, or deployed. This report supersedes the initial 90-question MVP readiness report.

| Grade | Science | Social Studies | Reading/ELA | Total | Max Mixed Rounds | READY? |
|---|---:|---:|---:|---:|---|---|
| Kindergarten | 10 | 15 | 20 | 45 | 45 until exhausted / 30 preset | READY |
| 1st | 15 | 12 | 18 | 45 | 45 until exhausted / 30 preset | READY |
| 2nd | 12 | 15 | 18 | 45 | 45 until exhausted / 30 preset | READY |
| 3rd | 12 | 12 | 21 | 45 | 45 until exhausted / 30 preset | READY |
| 4th | 15 | 15 | 15 | 45 | 45 until exhausted / 30 preset | READY |
| 5th | 12 | 15 | 18 | 45 | 45 until exhausted / 30 preset | READY |

270 total questions; 180 added. The original 90 records are unchanged. Of the additions, 58 are direct conversions of existing CurricuPlay content and 122 are new source-backed exercises. Including the original conversions, 148 questions in the expanded bank are converted items.

Ten questions have optional visuals (nine added), using only local SVG assets. The other 260 are text-only. Visuals cover sky observations, plant parts, distance models, map/globe reading, Moon observations, and a silt-fence model.

Correct-answer distribution: **A 68 / B 68 / C 67 / D 67**. Each grade has 11 or 12 answers in each position. New answer positions have no fixed cycle; the longest authoring-order run is three. Queue shuffling also randomizes classroom order.

## Subject shortages and availability

Relative to 15 per subject: Kindergarten Science is short five; first-grade Social Studies is short three; second-grade Science is short three; third-grade Science and Social Studies are each short three; fifth-grade Science is short three. Fourth grade reaches 15 in all three subjects. Supported ELA content compensates for these shortages without importing future topics or duplicating the same question.

All grades support fixed 10, 15, 20, and 30-round Mixed Academic games. Thirty-round games allocate 10 questions per subject. “Play Until I Stop” uses all 45 eligible questions, redistributing toward the larger supported subject pools while avoiding adjacent repeats in these pools.

All 18 single-subject pools support at least 10 rounds and “Play Until I Stop.” Fifteen-round single-subject games are available where the table shows at least 15 questions. Twenty-round single-subject games are available for Kindergarten and third-grade ELA only. No single subject currently supports 30 rounds. Unavailable round options explain the precise shortage and are disabled.

Counts assume no local teacher vetoes. Existing vetoes on a parent question/original draft, and vetoes on a direct conversion source, are respected.

## Gameplay and persistence

The existing Four Corners screen is retained. Added only the requested 30-round and Play Until I Stop choices, End Game, and completion messaging. Until-stop progress says “Round 12,” without a denominator. Finishing the saved queue says exactly: “You've used every available question in this content pool.” Ending early does not falsely claim exhaustion.

Queues are generated locally once per game and saved in order; visited IDs and reveal state persist. Refresh never requests new questions. No live generation or repeated items extend a running game. Reset/Play Again explicitly starts a new game. Legacy 15-round MVP saves remain valid with their original questions, ordering, and reveal state.

Jeopardy code, question content, storage, and existing regression tests are unchanged by this expansion. The existing unrelated `TOMORROW_SPOT_CHECK.md` edit is untouched.

## Validation and testing

Content command: `python3 scripts/validate-four-corners.py` — zero errors. Checks cover IDs, normalized exact duplicates, four distinct choices, unique answer mapping, primary pacing row/date, local evidence excerpts, future content, external materials, length, local assets/alt text, baseline immutability, and answer-position distribution. Similarity candidates and repeated choice sets are recorded for semantic review, not hidden.

See [editorial/source review](FOUR_CORNERS_EXPANSION_REVIEW.md) and [machine-readable audit](FOUR_CORNERS_EXPANSION_VALIDATION.json) for duplicate dispositions, source boundaries, wording corrections, and limits of automated ambiguity checks.

Browser coverage includes all six complete 30-round games and all six 45-question exhaustion games; no repeats, grade/date eligibility, 10/10/10 fixed-round balance, full-pool coverage, correct answers, reveal/next, refresh before and after reveal, saved completion, and no scrolling/clipped panels at 1920×1080. It also covers the original 15-round flow, all available single-subject fixed-round modes, until-stop early ending/reset, single-subject exhaustion, full screen, corrupt saves, teacher vetoes, storage failures, legacy MVP saves, and preservation of an active Jeopardy game.

All ten visual items load during full-pool tests; text-only items are checked separately. Screenshots from every grade were visually inspected, including the plant arrow, sky comparison, distance model, globe, Moon record, and silt fence.

Final combined test result: **67 passed (2.1 minutes)** with `npx playwright test --workers=2`: **30 Four Corners tests and all 37 existing Jeopardy/content/review regression tests**. All six actual Jeopardy release-pack games passed. The final teacher-veto assertion also passed its targeted rerun. Scope stopped after expansion and verification.

Production build passes. The existing Vite bundle-size warning remains non-blocking. `git diff --check` passes.
