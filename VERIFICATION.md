# Current verification — self-contained question rule

24 Chromium tests passed (51.0s). Production build and full content validation passed. See [the current material audit report](content/reports/MATERIAL_AUDIT_REPORT.md) for counts, per-question inventory, exclusions, and test details.

No auto-approval occurred. At the audit checkpoint, new material metadata and replacement wording invalidated previous local review fingerprints. The subsequent reconciliation pass below now preserves safe metadata-only decisions. All 216 source records remain pending. The current self-contained bank has 197 drafts; the other 19 cannot enter gameplay even if approved. K/1 can support full boards after balanced teacher approval; grades 2–5 have category gaps. The 197 safe questions were rendered in gameplay at 1920 × 1080, and all 19 excluded records were checked in Question Review.

---

The following is the earlier verification history, before the self-contained-only rule; earlier coverage claims are superseded by the current material audit.

# Verification — September 13, 2026

## Content expansion

Added 108 evidence-backed drafts; the bank now has 216 pending questions, 36 per grade K–5. All 108 previous question records are byte-equivalent as parsed JSON, preserving their local review fingerprints. Curriculum remains 755 records; no dates or existing mappings changed. No new question is assigned to instruction after September 13, 2026. No source question was automatically approved.

Each grade has 12 Literacy, 12 Math, 6 Science, and 6 Social Studies drafts, with 12 questions at each difficulty. Review shares these IDs. 68 questions require teacher checking or classroom materials. The evidence supports practice prompts or explicit teacher-check tasks; source quotations are not a guarantee of educational correctness.

`npm run content:validate` passed for every curriculum record and question: exact source-cell/evidence fidelity, metadata, standards/session mappings, dates, unique IDs, duplicate and near-duplicate screening, question/answer length, and K/1 teacher-read checks. No validation errors, warnings, or near-duplicate candidates remain.

## Browser and build

`npm test -- --workers=2`: **22 passed (60.0s)** in Chromium.

- Every one of the 216 actual drafts rendered and revealed at 1920 × 1080 in isolated 18-question batches, with exact answers, no repeated questions, no viewport overflow or inner-content overlap, and no browser console errors.
- Six complete 30-tile games used the expanded real drafts with approval simulated in the test browser. Subject-first selection completed all tiles without repeated IDs in every grade.
- Six synthetic 60-question-per-grade games also passed, including Review-first order for alternate grades, exactly two opportunities at each category/difficulty, at least 150 × 80 pixel tiles, used/disabled tiles, reset, refresh, K/1 messaging and navigation.
- Local review tests cover Edit & Approve, unchanged Approve, Needs Review withdrawing approval, Reject, all filters, persistence, unsaved edits, storage failure, source-change invalidation, and future-content exclusion.
- Question Review and a grade-5 question screenshot were visually inspected at 1920 × 1080. Long teacher evidence can scroll in the internal review screen; gameplay does not scroll.

`npm run build`: passed TypeScript and Vite production build. Vite emits a nonfatal bundle-size advisory because curriculum evidence is included in the internal review screen (approximately 140 KB gzipped JavaScript).

## Remaining classroom-readiness limits

There are zero source-file approvals. Teacher decisions in an existing browser are separate and retained; test approvals did not affect source data or the teacher’s browser. Review through Home → Teacher tools · Question Review, in the same browser and URL used for class.

Every grade needs teacher approval and at least 24 additional high-quality supported drafts to reach 60 if every existing draft is approved. Counts do not guarantee category availability: Science/Social Studies have only two questions per difficulty, which Review-first play can consume. All grades still have Recent Content category gaps, including grade 1 despite its 30 recent drafts. This earlier selection-order limitation is now resolved for new games by reserving 30 distinct eligible questions before launch; see the classroom-trial verification below.

706 curriculum records have no attached question evidence: 613 future planned records excluded from current generation, 75 dated records through the cutoff, and 18 undated records. Another 49 are only partially supported; their remaining references stay unresolved. Existing K/grade-3 math timing conflicts and other source issues remain flagged. Full inventories and coverage deficits are in `content/reports/IMPORT_REPORT.md`, `validation.json`, and `curriculum-review.csv`.

## First-grade classroom trial preparation

No curriculum or question data was changed in this pass. All 216 shipped questions remain pending (36 per grade). Review is directly accessible at /#review, preselecting first grade, and through the Home/setup header. The 36-item queue supports a jump selector and optional advance after an explicit saved decision. Teacher-check, materials, word-wall and unresolved-reference caveats are prominent above the editor; source quotations remain visible beside it.

The shared question engine now finds a complete one-question-per-slot assignment across overlapping pools. Both setup and the review trial button require 30/30 assignable tiles, not merely 30 approvals. Launch randomizes and persists unique reservations; tile choice cannot consume another tile's question. Reset creates a new reservation plan. Eligibility is checked again on resume and during play; withdrawn approval pauses or invalidates a board.

The first-grade trial browser test explicitly approved all 36 drafts in its isolated browser using the review buttons, then completed all 30 tiles in reverse order (Review first), with no unavailable unplayed tiles, duplicate IDs, wrong-grade/future questions, or scrolling at 1920 × 1080. Refresh preserved reservations and the active question; reset restored all 30 opportunities. Tests also verify exactly 30 balanced approvals can be matched, reject unbalanced pools, exclude pending/rejected/future questions, and block a saved trial when a Science approval is withdrawn. First-grade Recent Content remains blocked due to Social Studies coverage.

The full 22-test suite passed, including rendering/revealing all 216 drafts. First-grade review and trial screenshots were visually inspected. Production build and complete content validation passed; Vite retains its nonfatal bundle-size advisory (~141 KB gzipped JavaScript). These tests do not approve questions in the teacher's browser or certify academic quality. The classroom trial becomes available after the teacher's actual reviews satisfy the live readiness check.

## Human review reconciliation — September 13, 2026

First-grade source audit: 30 metadata-only records, 6 replacement questions, 0 other substantive changes. Actual prior approval/rejection totals belong to the teacher browser and cannot be inferred from pending source JSON or synthetic test decisions.

The resolver preserves only matching decisions with an unchanged full source record, or additions of the explicit false material flag and harmless audit note with exactly matching reviewed question/answer. It compares all other fields, ignores object-key ordering, and never rewrites saved review snapshots or timestamps. Changed approvals become pending; rejection remains a gameplay veto. Pending and missing decisions never become approved.

27 Playwright tests passed (37.1s), including synthetic historical-review migration, metadata-only approvals/rejections, all material changes, prior local edits, malformed snapshots, refresh without rewriting storage, attention filtering and queue advancement. Existing full 30-tile games, no-repeat behavior, future/pending/rejected/material exclusions, reset and 1920×1080 gameplay layout passed. Inspected the review reconciliation screenshot at 1920px width; the teacher review screen scrolls as before, gameplay does not.

Content validation passed for all 216 questions and 755 curriculum records with no errors, warnings or near-duplicate candidates. Production build passed; Vite retains its existing advisory about bundled curriculum data exceeding the 500 kB chunk threshold. No questions or human approvals were generated.

## First-grade authentic-content correction — September 13, 2026

Withdrew five invented-location prompts through a deterministic ingestion exclusion manifest. Retained their full records and reasons outside the active bank. Reworded one math prompt as an everyday addition problem; its old approvals cannot carry over. Thirty other first-grade records remain unchanged. Active counts are now 211 overall and 31 first-grade drafts. First-grade Social Studies has one question, so even all 31 approvals cover only 25/30 tiles; launch correctly remains disabled.

Content validation passed for all 211 active questions and 755 curriculum records. Production build passed with the existing data-chunk size advisory. All 28 Playwright tests passed (38.1s), including the explicit first-grade shortage check, preserved-decision checks, pending/future/material exclusions, all active self-contained question rendering at 1920×1080, full-board engine tests with synthetic fixtures, and a real Kindergarten draft-bank trial. First grade's real current bank is deliberately not claimed to support a complete game.

## Tomorrow Pack — September 14 classroom release

The separate Tomorrow Pack retains 175 accepted questions after evaluating 314 candidates (103 newly authored plus 211 existing drafts). Its cutoff is September 13, 2026. Acceptance is automated validation plus assistant editorial review authorized for this release; no human review or old draft approval is fabricated. Normal gameplay uses the pack, while Teacher Tools and its trial flow retain the independent draft bank. Reused-draft teacher vetoes remain effective. New questions retain curriculum-template provenance without inheriting unrelated template decisions.

Actual pack coverage: K 30/30, grade 1 28/30, grade 2 30/30, grade 3 27/30, grade 4 30/30, grade 5 30/30. Grades 1 and 3 are deliberately BLOCKED, not marked ready. Their gaps are first-grade Social Studies (one 2-point, one 3-point) and third-grade Social Studies (one at each point value).

Full suite: 37 passed (42.8s). After final wording/provenance edits, all 9 pack browser checks passed again (7.7s). The four complete grades each played all 30 actual pack questions, with no duplicate IDs/text, no future/external/pending/rejected items, answer reveal, USED tiles, reset, grade change, home, question/answer refresh and no scrolling at 1920×1080. All 55 retained questions in blocked grades also rendered and revealed at that viewport using test-only single-question resume fixtures; these are not full-game passes. Inspected actual question and USED-board screenshots. Existing full-board synthetic fixture tests still cover all six grades independently of academic-content shortages.

Both the 755-record/211-draft pipeline validation and separate pack validation pass. Production build passes with the existing large-data-chunk advisory. Detailed evidence/quality limitations, source errors, candidate counts and five spot-check questions per grade are in content/reports/TOMORROW_PACK_REPORT.md and TOMORROW_SPOT_CHECK.md.


## Five-question completion — September 13, 2026

Supersedes the earlier first/third-grade shortage: all six grades now have 30 eligible questions and 30/30 board assignments. Evaluated three options for each missing slot (15 candidates), retained exactly five, and recorded ten rejected alternatives in `content/tomorrow/candidates.json`. All 175 previously accepted question objects are unchanged; K, 2, 4 and 5 content is unchanged.

- Grade 1, 2 points: read the city and state in “Memphis, Tennessee.” The linked district teacher notes verify this real location pair.
- Grade 1, 3 points: compare address endings “Atlanta, Georgia” and “Savannah, Georgia.” The linked notes verify both locations; only the already-taught city/state concept is assessed, not the notes’ historical biography.
- Grade 3, 1 point: identify the direction opposite north.
- Grade 3, 2 points: identify the direction between south and west.
- Grade 3, 3 points: reason through facing west, a right quarter turn, then turning around.

Third-grade direction evidence is the labeled compass rose on slide 16 of the Unit 2 Source Set explicitly linked in the August 17 district lesson. A positional transcription, original image part and SHA-256 are saved in `content/sources/tomorrow-3-compass-evidence.json`. This adds no curriculum standard or future lesson. No question needs an external resource.

Deterministic validation: zero errors, zero near-duplicates, all six grades 30/30, exactly ten questions per difficulty per grade. Classroom acceptance remains assistant editorial/automated acceptance authorized for this pack, not a claim of human teacher approval.

Requested browser rerun: first- and third-grade actual release coverage/classroom-flow tests **2 passed (6.4s)**. Each played all 30 actual questions with no repeats or unavailable tiles, checked cutoff/material/status eligibility, reveal, USED state, reset, grade change, refresh/localStorage, no console errors, and no scrolling at 1920×1080. Other grades retain their previous passing results; their tests were not rerun. No app code or appearance changed.


## Student-facing answer audit

Audited all 180 Tomorrow Pack answers; updated 21 (K: 10, 1: 1, 2: 3, 3: 2, 4: 1, 5: 4). Only answer text and its derived audit fingerprint changed in the pack. Accepted candidate answers were updated so rebuilding preserves the cleanup. Full before/after record: `content/reports/TOMORROW_ANSWER_AUDIT.json`. Both content validators passed. All six K–5 actual release gameplay browser tests passed (7.5s), including full 30-tile boards and 1920×1080 layout checks.


## Read-aloud wording audit

Audited all 180 Tomorrow Pack questions. Revised 42 questions (K: 2; 1: 9; 2: 7; 3: 6; 4: 9; 5: 9) and six accompanying answers. All curriculum and difficulty metadata preserved. Full before/after record: `content/reports/TOMORROW_WORDING_AUDIT.json`. Both content validators passed, and all six complete K–5 gameplay browser tests passed (7.6s), including all 180 questions, reveal, persistence, reset and 1920×1080 layout checks. No app features or appearance changed.
