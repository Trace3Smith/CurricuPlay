# Four Corners question-and-choice quality audit — September 17, 2026

This report supersedes the earlier 270-question expansion readiness and editorial reports. A later writing-and-clarity pass is recorded separately in [FOUR_CORNERS_CLARITY_PASS.md](FOUR_CORNERS_CLARITY_PASS.md); it reworded 65 items and added 264 reveal-line explanations without changing any key, position, count, or citation, and it is the reason ledger records now read `disposition: "clarified"` with the audit verdict kept in `qualityDisposition`. The active bank has **264 questions: 230 records preserved exactly, 34 revised, and six withdrawn**. No replacement questions were generated to conceal the resulting coverage loss. Jeopardy content and behavior were not changed by this audit. Nothing was pushed or deployed.

## What each task actually assesses

- **Intentional matching:** upper/lowercase letter matching needs visible printed letters. Three matching items and one letter-name-to-print identification item remain valid visual tasks. They now explicitly say “LOOK AT THE PRINTED LETTERS · TEACHER READS THE QUESTION ONLY.” They are not labeled comprehension or spoken-word recognition.
- **Spoken-word recognition:** printing “Find you” alongside “you” allows identical-shape matching. Reading that same visible prompt aloud does not solve the problem. Five Kindergarten target-word items (`in`, `you`, `is`, `that`, `it`) were withdrawn rather than relabeled or rewritten to assess another skill. The current shared-screen format does not establish recognition from a spoken target alone.
- **Phonics:** retained sound comparisons ask students to analyze sounds in words; the teacher can read their words and alternatives aloud. The first-grade “bed” vowel-letter item was withdrawn because hearing a vowel sound and selecting a named/printed vowel are not interchangeable, and the printed target also gives away the spelling.
- **Comprehension:** retained short passages include all needed information on screen and have existing linked lesson evidence for details, sequence, main idea, inference, or other applicable comprehension skills. Teacher reading makes them listening-comprehension practice; it is not evidence of independent decoding. No new passage was substituted for a sight-word item.
- **Sentence completion:** the existing “cat ___ wet” question and options remain unchanged. Its evidence now cites the actual August 31 complete-thought sentence goal instead of the sight-word list. Selecting a well-formed sentence is not a writing-mastery assessment. Its standard remains null; no new code was invented.

The machine-readable [item audit](../four-corners/quality-audit.json) records each original question and all four choices, disposition, assessed skill, delivery, rationale, and complete after-state. The [withdrawal ledger](../four-corners/quality-withdrawals.json) preserves all six removed records and reasons. The [pre-audit snapshot](../four-corners/pre-quality-audit.json) permits exact comparison.

## Prompt, answer, and distractor review

All 270 original prompt-and-choice sets were reviewed together for a single task, a defensible key, plausible alternatives, self-contained information, natural read-aloud wording, grade suitability, and skill/evidence fit. Necessary content revisions clarify Georgia as the U.S. state, explicitly ask for gratitude, remove a false generalization about nations containing states, and improve weak or synonymous alternatives in sky observations, a cup/water sequence, compound-word parts, rock comparisons, erosion evidence, story setting, cause/effect, and main-idea scope. Valid questions were preserved, including their answer positions.

Eight grade-3 globe/direction items inherited SS3G1 landform alignment; nine grade-5 economics/community-business items inherited SS5CG1 citizenship alignment. These inappropriate codes were removed **only from Four Corners**. Existing dated pacing rows still control eligibility, and existing district lesson excerpts support the concepts. The documented unit title supplies the lesson reference. No replacement standard code is asserted. This explicitly distinguishes dated topic evidence from verified standard-level alignment.

Similarity checks flagged 12 prompt pairs and three repeated unordered choice sets at the time of this audit; the later clarity pass reduced the prompt pairs to eight without adding any. Different taught letter/sound targets remain distinct skills/examples; latitude versus longitude and separate event sequences are not duplicate answers. Repeated choice sets for real place categories, Earth processes, and cardinal directions are intentional: the prompts ask different concepts or spatial reasoning. They were reviewed rather than altered just to evade a similarity threshold. Automated checks cannot prove semantic correctness; the item audit records the editorial decisions.

## Current coverage

| Grade | Science | Social Studies | Reading/ELA | Total / maximum mixed pool | 30-round mixed |
|---|---:|---:|---:|---:|---|
| K | 10 | 15 | 15 | 40 | READY |
| 1 | 15 | 12 | 17 | 44 | READY |
| 2 | 12 | 15 | 18 | 45 | READY |
| 3 | 12 | 12 | 21 | 45 | READY |
| 4 | 15 | 15 | 15 | 45 | READY |
| 5 | 12 | 15 | 18 | 45 | READY |

New losses: K ELA drops from 20 to 15; first-grade ELA drops from 18 to 17. Kindergarten no longer offers a 20-round ELA game. Spoken-target sight-word recognition is an explicit coverage gap, not silently replaced with comprehension. The removed first-grade isolated vowel identification item has no replacement; other supported vowel comparisons remain.

Existing shortages against 15 per subject remain: K Science −5; grade 1 Social Studies −3; grade 2 Science −3; grade 3 Science −3 and Social Studies −3; grade 5 Science −3. No future content or unsupported items were introduced to fill them. Every grade still has enough for a 30-round mixed queue with 10 items per subject. Until-stop consumes the full eligible pool without repeats.

There are 10 optional local visual questions. Correct-answer distribution is **A 67 / B 66 / C 65 / D 66**. No answer positions were shuffled merely to hide the withdrawals. Of the 180 expansion additions, 177 remain (57 conversions and 120 source-supported exercises); 87 of the original 90 remain. This audit adds zero questions.

## Verification

The content validator checks all active records against their reviewed after-state and all 230 preserved records against the pre-audit snapshot. It also checks duplicate IDs/prompts/choices, key mapping, source excerpts, timing, external-material requirements, length, and local visual assets. It reports zero errors and zero unreviewed changes. The September 13 cutoff remains conservative; it does not automatically pull in future weeks.

Browser regression results are recorded below after the full run. Coverage includes complete 15- and 30-round mixed games in all six grades, until-stop exhaustion, every available single-subject mode, reveal/next/reset/change grade, answer mapping, no repeats, subject balancing, refresh recovery, visual and text-only rendering, and 1920×1080 overflow checks. A dedicated regression verifies the printed-letter cue and safe recovery to setup when an old save includes a withdrawn question. Existing eligible saves remain recoverable; withdrawn questions are never resurrected.

Build: passed; Vite retains its nonblocking bundle-size warning.

Final result: **68/68 Playwright tests passed (2.1 minutes)** — 31 Four Corners tests and all 37 existing Jeopardy/content/review regressions. The letter-delivery screenshot was also inspected at 1920×1080: prompt, cue, four choices, and controls fit without scrolling. Validator: zero errors. `git diff --check`: passed. Work remains on `four-corners-mvp`; no push or deployment.
