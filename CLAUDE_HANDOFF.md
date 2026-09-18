# CurricuPlay — Four Corners handoff to Claude Code

Prepared September 17, 2026. Work only in `/home/trace3smith/curricuplay/CurricuPlay`.
Branch: `four-corners-mvp`. Origin: `https://github.com/Trace3Smith/CurricuPlay.git` (fetch and push verified).
No merge into main, force-push, or production promotion is authorized. The user authorized committing this feature/handoff and pushing this branch only. Stop after handoff; future edits require the next task.

## Current feature and content

Four Corners is a separate K–5 game reached from Home or `/#four-corners`. It has Science, Social Studies, Reading/ELA, and balanced Mixed Academic; 10/15/20/30 rounds when available, plus Play Until I Stop. Reveal/next, reset, grade changes, fullscreen, early ending, pool exhaustion, and refresh recovery are implemented. No scoring, timers, elimination, live generation, or external image hosts. Scope remains frozen.

The quality audit reviewed each of 270 prompts together with all four options. **230 records are unchanged, 34 revised (including evidence/metadata/delivery fixes), six withdrawn, 264 active**. The record-level audit has complete before/after states. Ten questions use nine local SVG assets. Correct answer positions: A 67, B 66, C 65, D 66. Of the expanded additions, 177 remain: 57 conversions and 120 source-supported exercises; 87 original MVP questions remain. Zero questions were added in the final quality audit.

| Grade | Science | Social Studies | Reading/ELA | Total / maximum mixed pool | 30-round mixed |
|---|---:|---:|---:|---:|---|
| K | 10 | 15 | 15 | 40 | READY |
| 1 | 15 | 12 | 17 | 44 | READY |
| 2 | 12 | 15 | 18 | 45 | READY |
| 3 | 12 | 12 | 21 | 45 | READY |
| 4 | 15 | 15 | 15 | 45 | READY |
| 5 | 12 | 15 | 18 | 45 | READY |

Counts assume no local teacher vetoes. All grades support 10 questions per subject in 30-round mixed games; until-stop consumes the available full pool without repeats.

## Remaining quality limits and coverage gaps

- Five K “Find [word]” items exposed the target in both prompt and choice, allowing visual matching instead of spoken-word recognition. They were removed, not converted into comprehension. K ELA fell from 20 to 15; 20-round K ELA is unavailable. Spoken-target sight-word recognition remains a coverage gap in this shared-screen format.
- One first-grade printed “bed” vowel-letter item conflated vowel sound and letter identification. It was removed; ELA fell from 18 to 17. Other supported sound comparisons remain.
- Preserve intentional letter matching as a visual skill: four letter tasks explicitly instruct the teacher to read the question only while pupils inspect print. Do not label matching, spoken-word recognition, and comprehension interchangeably.
- Existing short comprehension passages are self-contained and supported by cited skills. Teacher-read passages assess listening comprehension, not independent decoding. Do not manufacture new passages or alignment to replace a weak sight-word item.
- K sentence completion now cites the existing complete-thought sentence goal. It is not proof of writing mastery.
- Eight grade-3 globe/direction and nine grade-5 economics/community items had mismatched inherited standard codes. Those codes are now null; existing district lesson/unit references support topics and pacing rows control dates. No replacement code was invented. Standard-specific alignment remains unasserted for these items.
- Shortages against 15 per subject: K Science 5; grade 1 Social Studies 3; grade 2 Science 3; grade 3 Science 3 and Social Studies 3; grade 5 Science 3. Quality takes priority over quota. No future content should fill these gaps.
- Similarity candidates and repeated choice sets were editorially reviewed; see the report. The clarity pass cut prompt-similarity candidates from 12 pairs to eight and added none; the three repeated choice sets are unchanged and intentional. Automated structural checks cannot prove semantic correctness or curriculum mastery. Source snapshots are not blanket approval for everything in a document.
- All 264 active items now carry a one-sentence `explanation`, rendered on the reveal line. These are editorial reveal lines restating the prompt, choices, or cited skill; they are **not** separately teacher-approved curriculum text and assert no standard or evidence of their own.
- No standard-code check runs against the Four Corners bank. `scripts/validate-four-corners.py` verifies the pacing row and evidence quote but never reads `standard`. `scripts/build-tomorrow-pack.py` line 25 is the only standard-vs-pacing check in the repo and covers the Jeopardy pack only. Porting it to Four Corners is deferred pending a reviewed exemption list.
- The FY27 workbook records Literacy as program/session references, not codes: **0 of 222 Literacy pacing rows carry any standard code, and no Georgia ELA-format code appears in any of the 15 workbook tabs.** `references()` in `ingest-content.py` now recognises the ELA code shape, but no code can be recovered from this source; those items stay session-anchored.
- Eligibility deliberately stays capped at **2026-09-13**, via shared `PACK_CUTOFF`. Do not silently advance it or change shared Jeopardy timing.

## Exact paths and authority

All paths below are relative to the repository root above.

### Runtime and review authority

- `src/data/four-corners.json`: authoritative active, curated Four Corners runtime bank; not safe to overwrite from old authoring scripts.
- `content/four-corners/quality-audit.json`: authoritative per-item editorial disposition and complete before/after record. Records touched by the September 17 clarity pass read `disposition: "clarified"`, keep the audit's verdict in `qualityDisposition`, and carry `clarityNotes`. Validator requires active after-states to match the runtime bank. Review both together for any authorized future edits; do not simply regenerate this ledger to bless arbitrary changes.
- `content/four-corners/quality-withdrawals.json`: withdrawn full records and reasons; do not reintroduce them.
- `content/four-corners/pre-quality-audit.json`: immutable historical 270-item snapshot.
- `content/four-corners/mvp-baseline.json`: immutable historical 90-item snapshot; necessary audited changes supersede its old preservation claim.
- `src/games/four-corners/engine.ts`: eligibility, queue balancing, validation, types, persistence.
- `src/games/four-corners/FourCorners.tsx`: separate setup/gameplay UI.
- `src/games/four-corners/four-corners.css`: game styles, scoped `.fc-*` selectors.
- `src/App.tsx`: only shared UI integration (Home card and hash routing).
- `tests/four-corners.spec.ts`: content and browser regressions. Existing other `tests/*.spec.ts` cover Jeopardy, source review, and classroom workflows.

### Source evidence (timing takes precedence)

- `content/sources/pacing-guide-cells.json`: original cell-level DCSS FY27 timing authority.
- `content/sources/pacing-guide-export.txt`: human-readable original workbook snapshot.
- `content/sources/README.md`: provenance and snapshot restrictions.
- Exact lesson snapshots cited by active Four Corners items: `content/sources/linked-1-literacy.json`, `content/sources/linked-k-literacy.json`, `content/sources/linked-k-science-social.json`, `content/sources/support-2.json`, `content/sources/support-3.json`, `content/sources/support-6.json`, `content/sources/support-8.json`, `content/sources/support-11.json`, `content/sources/support-12.json`, `content/sources/support-13.json`, `content/sources/support-16.json`, `content/sources/support-17.json`, `content/sources/support-18.json`, `content/sources/support-21.json`, `content/sources/support-22.json`, `content/sources/tomorrow-3-geography.json`, `content/sources/tomorrow-4-history.json`, `content/sources/tomorrow-5-civics.json`.
- Each item's `evidence.document`, quote, source URL, curriculum ID, and dates identify its actual evidence. Do not treat other sections as already taught.
- `src/data/curriculum.json`: generated normalized pacing rows, consumed by shared services.
- `src/data/tomorrow-pack.json`: existing validated classroom pack and primary conversion/approval anchors; preserve it.
- `src/data/questions.json`: generated draft bank; not globally teacher-approved. A cited conversion is not approval of all drafts.
- Existing source authoring/review inputs include `content/question-drafts.json`, `content/material-audit.json`, `content/withdrawn-questions.json`, `content/tomorrow/candidates.json`, `content/tomorrow/verified-source-links.json`, and `content/templates/`. Preserve them and existing approval records.

### Visuals

Local authored assets: `public/four-corners/compass.svg`, `day-night.svg`, `distance.svg`, `globe.svg`, `moon-record.svg`, `plant.svg`, `plant-leaf.svg`, `silt-fence.svg`, `trail-map.svg` (all in `public/four-corners/`). Useful alt text is stored with each question. No external fetch is needed.

### Scripts and generated outputs

- `scripts/validate-four-corners.py`: validates bank/ledger, structure, evidence, date cutoff, assets, duplicates and similarity candidates; generates `content/reports/FOUR_CORNERS_EXPANSION_VALIDATION.json`. It does not generate questions.
- `scripts/validate-content.py`: shared content validator; generates `content/reports/validation.json`.
- `scripts/report-citations.py`: read-only citation-coverage inventory across all three banks; generates `content/reports/CITATION_COVERAGE.json` and `.md` (`npm run content:citations`). Reports only — it enforces nothing and never reads or writes question content.
- `scripts/ingest-content.py`: existing curriculum/draft importer; writes `src/data/curriculum.json`, `src/data/questions.json`, `src/data/replacementQuestionIds.json` and source reports.
- `scripts/expand-templates.py`: existing draft template generator; writes `content/templates/pilot-variants.json` and template report. Not a Four Corners generator.
- `scripts/build-tomorrow-pack.py`: existing classroom pack builder; writes `src/data/tomorrow-pack.json` and Tomorrow reports, including the locally edited spot-check report. **Do not run as a handoff validation step.**
- `scripts/report-content.py`: existing shared reporting script.
- There is **no checked-in, supported Four Corners generation script**. Earlier authoring used ad hoc session scripts; the reviewed bank and full audit snapshots are the durable artifacts. Do not attempt a blind regeneration or claim reproducible authoring from the existing shared generators. Runtime never generates new questions.
- `content/reports/FOUR_CORNERS_QUALITY_AUDIT.md`: current editorial/readiness report.
- `content/reports/FOUR_CORNERS_CLARITY_PASS.md`: September 17 writing-and-clarity pass — 65 reworded items, 264 reveal-line explanations, no key/position/count/citation change.
- `content/reports/CITATION_COVERAGE.md` / `.json`: generated standard-code provenance inventory. Current state: 0 of 655 items missing a pacing citation; 247 carry no workbook-verified standard code. Earlier `FOUR_CORNERS_READINESS.md`, `FOUR_CORNERS_EXPANDED_READINESS.md`, and `FOUR_CORNERS_EXPANSION_REVIEW.md` are marked historical/superseded.
- `dist/`, `test-results/`, `playwright-report/`, `node_modules/`, and `*.tsbuildinfo` are generated/ignored, not handoff source.

## Validation, tests, build, and preview

Run from the repository root. Dependencies are currently installed; on a new checkout use `npm ci` and install Playwright Chromium if needed (`npx playwright install chromium`). Do not update dependency versions as part of this handoff.

```bash
npm run content:validate
python3 scripts/validate-four-corners.py
# Full suite includes Four Corners AND all existing Jeopardy/content/review tests:
npx playwright test --workers=2
# Optional separate runs to isolate a failure:
npx playwright test tests/four-corners.spec.ts --workers=2
npx playwright test tests/content.spec.ts tests/game.spec.ts tests/materials.spec.ts tests/reconciliation.spec.ts tests/review.spec.ts tests/tomorrow.spec.ts tests/trial.spec.ts --workers=2
npm run build
# Development preview:
npm run dev -- --host 127.0.0.1
# Production-build preview (after build):
npm run preview -- --host 127.0.0.1 --port 4173
```

Development: `http://127.0.0.1:5173/#four-corners`. Production-build preview: `http://127.0.0.1:4173/#four-corners`. Playwright starts its own Vite server and uses a 1920×1080 viewport; it reuses an existing server if available. Browser binding may require sandbox permission. No deployment command is needed.

Latest handoff verification: both validators passed (zero errors; shared validator zero warnings); production build passed with Vite's nonblocking >500 kB chunk-size warning. Full-suite handoff rerun: **68/68 passed (2.0 minutes): 31 Four Corners tests and 37 existing Jeopardy/content/review regressions**. No tests were weakened. Tests must not be weakened to accommodate content or runtime failures.

## Preserve Jeopardy, teacher work, and release boundaries

Keep Math excluded from Four Corners in bank, eligibility, UI, and tests. Jeopardy remains the computation game. Do not edit `src/games/jeopardy/`, shared question/review logic, existing Jeopardy banks, or existing regression tests for convenience. Four Corners shares source services but has separate UI/state.

Preserve localStorage `curricuplay.reviews.v1` teacher decisions and `curricuplay.game.v1` Jeopardy state. Four Corners uses `curricuplay.four-corners.v1`; parent/conversion vetoes remain effective. Never clear a teacher's browser storage or mass-approve drafts. Playwright uses isolated browser contexts. Saves containing a withdrawn question return safely to setup instead of restoring that item.

`content/reports/TOMORROW_SPOT_CHECK.md` had two pre-existing local wording edits before this work. They are intentionally left unstaged/uncommitted and remain in this workspace for the user/Claude. Do not revert or overwrite them. They will not be present in a fresh clone of this handoff commit.

Only explicit Four Corners feature files, its audit artifacts/assets/tests, the Home integration, and this handoff are to be committed. Exclude credentials, secrets, `.env*`, generated build/browser artifacts, and unrelated edits. Push only `four-corners-mvp`; do not force, merge, or promote production. A hosting integration may independently build a branch preview on push; no production deployment command is part of this handoff.
