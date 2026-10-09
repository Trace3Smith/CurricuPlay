# Spelling Bee curriculum expansion — local review

Branch: `classthread-spelling-bee-pacing`, based on `5e4c8e9308fa713be4519a83283d6272651a6602` (also the current remote Spelling Bee head). Local review: http://127.0.0.1:5173/games/spelling-bee . No deployment, merge, database migration, or remote branch change is part of this work.

## What changed

- Shared `src/curriculum/eligibility.ts` validates evidence and selects current, earlier, mixed, and general content. Its explicit initial cutoff is **2026-10-09**. `schoolDate()` uses `America/New_York`; setup offers a date picker and “Use today” without silently changing the audited cutoff.
- A current instructional period is the Monday–Friday school week containing the selected date. An item needs a documented period overlapping that week to count as Current Content. Earlier scheduled items remain available as review. When only a week is documented, eligibility starts at the **end of that week**, conservatively avoiding instruction scheduled later in the week. The schema also supports exact-day eligibility when evidence is available.
- All curriculum rows record grade, subject, target skill/term, source URL, unit, weekly locator, documented eligibility, category, timing status, and editorial approval. Teachers must separately approve the selected prompts and suitability before play. “Previously Taught” is explicitly explained as earlier **scheduled** content, not verified completion. No mastery claims are inferred.
- Source-listed terms, ClassThread practice derived from documented skills, and general practice remain visibly distinct. The teacher preview links each curricular prompt to its evidence. Custom lists can still be drafted, saved, approved, copied, and reused.
- Kindergarten defaults to a picture and **one hidden beginning-letter answer**. The object name is spoken through Say Word / Speak Clue, and is printed only after teacher reveal. Optional two/three-letter choices do not mark the correct choice. General/custom Kindergarten lists may explicitly select whole-word spelling; beginning-letter lists require matching reviewed pictures.
- Grades 1–2 build whole words with high-frequency/super-word sentence clues, short vowels, digraphs, final-e words, and documented blend practice. Helpful concrete-word pictures accompany clues.
- Grades 3–5 combine literacy, meaningful word parts, science, and social-studies vocabulary. Academic complexity adds an internal hint anchor in addition to length-based anchors. Full-word challenge and Reveal Another Letter remain available.
- **Play Until I Stop** is the default. Each selected pool is shuffled without repeating a prompt in a cycle. Current + Review interleaves shuffled current/earlier/prior-grade groups while available. At exhaustion the teacher must finish, add a reviewed selection at the **same cutoff**, or explicitly begin a repeat/review cycle. Scores and committed-response accuracy persist across all cycles.
- Version 2 session snapshots retain one copy of each prompt and use cycle-specific assessment IDs. Original version 1 saves and history still validate and play unchanged. Existing dedicated Spelling Bee keys are retained; no Jeopardy/Four Corners storage is rewritten. Storage failures remain visible and leave prior raw records untouched.
- 42 new label-free original SVG illustrations, plus the existing 10-image registry. Visual review removed three ambiguous Kindergarten candidates (mop/broom, ink/bottle, insect/bug). Teacher review remains necessary for local vocabulary and image recognition.

## Audited content as of October 9, 2026

Counts exclude prior-grade additions. General practice is a **separate alternative**, not an additive verified count.

| Grade | Eligible total | Current week | Earlier | Source-listed | Skill practice | General practice |
|---|---:|---:|---:|---:|---:|---:|
| K | 32 | 0 | 32 | 0 | 32 | 32 |
| 1 | 42 | 12 | 30 | 12 | 30 | 45 |
| 2 | 40 | 12 | 28 | 18 | 22 | 44 |
| 3 | 40 | 13 | 27 | 28 | 12 | 44 |
| 4 | 40 | 20 | 20 | 0 | 40 | 44 |
| 5 | 41 | 12 | 29 | 3 | 38 | 45 |

Kindergarten practices documented Unit 1 letters **M, T, A, S, B, I** using multiple objects. These are authored practice objects, not district-assigned spelling words. The default Current + Review mode uses this earlier bank; Current Content is deliberately empty because Unit 2 timing is unresolved.

Directly listed terms include Grade 1 `and, see, the, to, but, her, not, of, from, have, look, or`; Grade 2 documented high-frequency and community terms; Grade 3 vocabulary-notebook terms (`myth, fable, folktale, synonym, antonym, prefix, suffix` and others), dated science characteristics, and geography terms; Grade 5 `weathering, erosion, deposition`. **Source-listed does not mean a district-assigned spelling list.** Definitions and clues are original ClassThread wording. Grade 4 entries are conservatively labeled skill practice, including pre-/post-/mid- examples and domain vocabulary.

The complete per-word source-category/date audit is `content/spelling-bee/audit.csv`; summary is `audit.json`; evidence groups are in `evidence.json`. `content/spelling-bee/build-bank.py` reproducibly authors the bundled banks; it never scrapes terms automatically into approved content. `scripts/validate-spelling-bee-pacing.py` verifies source-listed terms in the **dated weekly section**, not merely somewhere in the document.

## Evidence access and unresolved timing

All 13 requested/relevant documents were fetched through the connected Google Drive plugin and retained as readable snapshots `content/sources/spelling-bee-2026-10-09-0.json` through `-12.json`:

- 0: supplied FY27 main workbook (`18MCIu-FTbhFipn3V2NbLpjqxleY1b_Uk35lvL-pEMgc`).
- 1–6: Kindergarten through Grade 5 literacy documents supplied in the request.
- 7: Grade 5 science document supplied in the request.
- 8–12: linked Grade 3 science/social studies, Grade 4 science/social studies, Grade 5 social studies.

No requested document was inaccessible. Existing September local snapshots were inspected as corroboration, not silently substituted for the supplied workbook. Their workbook ID differs; the new bank cites the supplied document and newly fetched linked guides. These are bounded readable connector snapshots, not a claim to have inspected every linked textbook, slide deck, assessment, or external publisher resource.

Unresolved or intentionally excluded:

- **Kindergarten Unit 2:** overview says Oct 19–Dec 4; weekly sections and workbook begin Sept 21. C/P/O/K/N introductions in that unit are not admitted as verified by Oct 9. A quarantined C/cat row demonstrates fail-closed behavior. Unit 3 also has inconsistent overview/weekly dates; it is outside this release’s bank.
- **Grade 3 science:** workbook includes S3L1 in the Sept 28 row while the support guide continues soils. No new Sept 28 soil/habitat terms are verified through that discrepancy. The four included science terms are from the clear Aug 10 rock/mineral characteristics section.
- **Grade 5 science:** broad weekly resource lists mention physical changes, states of water and chemical changes together. The appended detailed sequence provides more specific timing. States-of-water practice is conservatively assigned to Sept 28–Oct 2; chemical-change vocabulary was not expanded from the generic resource list. Electricity/magnetism starts Nov 9; `conductor` and `insulator` remain future-only rows until Nov 13 under the week-end rule.
- Broad unit standards are not treated as proof that every possible vocabulary word has already been introduced. Prior-grade review means one preceding grade at the same cutoff, not a claim about these students’ previous instruction.

## Shared-game integration audit

| Existing data | Present behavior | Controlled follow-up mapping |
|---|---|---|
| `Question.weekIntroduced`, `alignedWeeks`, `grade`, `subject` | Jeopardy engine uses `inRange`, grade, approval, unused IDs and template families. | Map to evidence-backed earliest eligibility and documented periods; reconcile week-start dates with exact/day or week-end safety. |
| `Question.evidence`, `sourceUrl`, `unit`, `session`, `reviewStatus` | Source quotes, offsets and timing bases already support reviewed questions. | Retain these as evidence locators; add source-listed/practice distinction and explicit unknown/conflict state after review. |
| `CurriculumEntry.weekOf`, `sourceCells`, `supportingEvidence` | Calendar rows preserve dates, URLs and imported evidence. | Derive periods only from reviewed, nonconflicting rows. Undated standards remain ineligible. |
| Four Corners `originId`, adaptation, parent approval and `PACK_CUTOFF` | Parent/child vetoes and current release cutoff gate playable questions. | Compose the shared eligibility gate with existing approval/adaptation rules; do not replace them. |
| Shared assessment `GameSession` | Unique question commits and actual team responses determine points/accuracy. | Already reused. Spelling Bee occurrence IDs keep repeat cycles distinct without individual mastery claims. |

No Jeopardy, Four Corners, authentication, teacher foundation, API, database, existing question-bank, timer, or assessment-engine logic was changed in this pass.

## Verification and practical limits

- Browser walkthrough performed for K, 2, 5: setup → clue/picture → hints/choices → team selections → commit → refresh → reveal → next → Games/Continue → end/summary, with no browser errors and 1920×1080 fit.
- Automated browser flows complete each selected K/2/5 cycle, test explicit repetition/additions, and preserve scores. Original v1 full games across all six grades remain covered.
- Engine tests exercise 400 committed prompts over ten repeat cycles, recovery, no duplicate scoring, cutoff boundaries, date changes, source ambiguity, review restrictions, and storage failures.
- Live gameplay has no mandatory scooter banner. Teacher-only previews may scroll inside their review panel; live controls fit the Smart Board.
- Audio uses installed browser voices; spoken output still depends on the school browser/device. Browser saves remain local to the device/origin and subject to storage quota; no cloud sync was added.
- This is a curated October 9 release, not a complete automatically synced school-year curriculum. Changing the date filters the authored bank; future weeks require additional reviewed evidence and content. The two future electricity examples are present for explicit boundary checks, not to fill October sessions.
- Build may report existing dependency annotation and large Games bundle warnings. This pass adds no production deployment or database migration.

## Final check results

- `npm test -- --workers=2`: **220 passed**, 3.7 minutes. Log: `/tmp/spelling-bee-pacing-regression.log`.
- Final isolated usability fix keeps the last answer hidden but revealable on the exhaustion screen and shows the object name in completed Kindergarten results. The optional Kindergarten whole-word setup now describes whole-word play correctly.
- After that fix, all four Spelling Bee spec files: **44 passed**, including the new final-answer regression, 23.4 seconds. Log: `/tmp/spelling-bee-pacing-final-check.log`.
- `npm run typecheck`: passed.
- `npm run build`: passed after the final fix. Log: `/tmp/spelling-bee-pacing-build.log`. Existing dependency/bundle warnings remain nonfatal.
- `npm run content:validate`, `npm run content:validate:spelling-bee`, `npm run content:validate:spelling-bee:pacing`: passed, no content errors.
- Actual Chromium walkthroughs for K/2/5 passed with no browser errors; screenshots were visually inspected. All new illustrations were inspected together. Live and summary screens fit 1920×1080. Full-cycle automated flows and legacy keyboard/mobile checks also pass.
- `git diff --check`: passed. No source changes to Jeopardy, Four Corners, shared assessment calculations, authentication, API/server, teacher foundation, routing, or deployment configuration.

## Changed-file guide

- Shared logic: `src/curriculum/eligibility.ts`.
- Spelling Bee: `src/games/spelling-bee/{bank,engine,words}.ts`, `WordBank.tsx`, `SpellingBee.tsx`, `spelling-bee.css`.
- Bundled content: `src/data/spelling-bee-{pacing,general,pictures}.json`; 42 SVGs in `public/spelling-bee/objects/`. Original sample JSON and illustrations remain unchanged for legacy recovery/general practice.
- Evidence and audit: 13 new dated snapshots under `content/sources/`; `content/spelling-bee/{build-bank.py,evidence.json,audit.json,audit.csv}`.
- Validation: `scripts/validate-spelling-bee-pacing.py`, the new package script in `package.json`, `tests/spelling-bee-pacing-engine.spec.ts`, `tests/spelling-bee-pacing.spec.ts`, and updated `tests/spelling-bee.spec.ts` (now explicitly verifies original saved v1 games).
- This review document. All changes remain uncommitted on the local review branch.
