> Historical report: superseded by [the September 17 question-and-choice quality audit](FOUR_CORNERS_QUALITY_AUDIT.md). Current bank: 264 questions; the original preservation and coverage claims below describe the earlier state.

# Four Corners MVP readiness — September 16, 2026

Branch: `four-corners-mvp`. Local implementation only; no push, merge, or production deployment.

| Grade | Science | Social Studies | Reading / ELA | 15-round Mixed Game | Blocker |
|---|---:|---:|---:|---|---|
| Kindergarten | 5 | 5 | 5 | READY | None for Mixed Academic |
| 1st | 5 | 5 | 5 | READY | None for Mixed Academic |
| 2nd | 5 | 5 | 5 | READY | None for Mixed Academic |
| 3rd | 5 | 5 | 5 | READY | None for Mixed Academic |
| 4th | 5 | 5 | 5 | READY | None for Mixed Academic |
| 5th | 5 | 5 | 5 | READY | None for Mixed Academic |

90 questions, all adapted from existing validated classroom questions. Each grade has a balanced 5/5/5 15-round game. Mixed Academic also supports 10 rounds. No Math.

Single-subject modes each have five eligible questions: five short of the minimum 10-round game, ten short of 15, and fifteen short of 20. Their round buttons and Start are disabled with explicit shortage messages. Mixed 20-round games are five questions short and disabled. This is the intentional content limit for this MVP; no quota filler or new external evidence was added.

One optional visual: a local SVG compass for grade 3. Other 89 questions are text-only. Useful alt text describes the compass without naming the requested intermediate direction.

| Grade | A | B | C | D |
|---|---:|---:|---:|---:|
| K | 4 | 4 | 4 | 3 |
| 1 | 4 | 4 | 3 | 4 |
| 2 | 4 | 3 | 4 | 4 |
| 3 | 3 | 4 | 4 | 4 |
| 4 | 4 | 4 | 4 | 3 |
| 5 | 4 | 4 | 3 | 4 |
| Total | 23 | 23 | 22 | 22 |

## Content and timing

`src/data/four-corners.json` retains grade, subject, curriculum IDs, introduction/aligned dates, standard/session, source URLs, evidence excerpts, and any existing factual verification evidence. `originId` links each adaptation directly to `src/data/tomorrow-pack.json`. The DCSS pacing rows retain control of timing. No linked documents were newly ingested.

Eligibility reuses the existing question engine, classroom pack, local review decisions, and curriculum date filter. The cutoff is the earlier of the current date and the existing September 13 classroom cutoff. Future aligned dates, unavailable parent questions, and parent/original-draft teacher vetoes cannot enter a queue. A restored session is revalidated before use.

Acceptance is assistant editorial review plus automated validation, not a claim of independent teacher certification. Four-choice distractors, answer mapping, concise teacher-readable prompts, and self-contained passages were checked. Original Jeopardy question data and its review decisions are unchanged.

## Implementation

- Separate component, engine, styles, and typed optional visual field under `src/games/four-corners/`.
- Minimal Home integration in `src/App.tsx`; existing Jeopardy engines, storage, curriculum, styles, and tests are unchanged.
- Versioned `curricuplay.four-corners.v1` storage saves grade, mix, round count, ordered IDs, current round, visited IDs, and reveal state. The `#four-corners` route restores the game on refresh. Home preserves progress.
- Mixed queues allocate evenly among available subjects, redistribute shortages, and weave subjects to avoid repeated runs when alternatives exist.
- Reveal, Next, completion, Reset, Change Grade, Home, and Full Screen. Everyone stays in; no scoring, timers, sound, teams, or external runtime image hosts.

## Verification

Four Corners browser checks cover all six real 15-round games and six 10-round games; all 90 questions are displayed and revealed. Checks include four distinct options, one answer mapping, source/date/grade eligibility, no repeated IDs, 5/5/5 subject balance, optional image load, text-only rendering, and no viewport scrolling or clipped panels at 1920×1080 before and after reveal.

All 18 grade/subject combinations were checked for accurate counts and disabled insufficient round options. Additional checks cover scarce-subject redistribution, single-subject queue mechanics, future exclusion, saved setup/game/completion recovery, corrupt saves, teacher vetoes, failed storage, navigation, fullscreen, and preservation of a revealed Jeopardy game across a Four Corners visit.

Screenshots are generated under `test-results/four-corners-*.png`. The compass and a revealed text-only question were also visually inspected.

Final suite result: **53 passed (1.4 minutes)** with `npx playwright test --workers=2`: **16 Four Corners tests and all 37 existing Jeopardy/content/review regression tests**. No existing tests were modified. All six actual Jeopardy classroom-pack games passed. Scope frozen after this successful run.

Production build passes. Vite reports a bundle-size warning; this does not prevent the build. `git diff --check` passes. Existing user edits to `TOMORROW_SPOT_CHECK.md` are untouched.
