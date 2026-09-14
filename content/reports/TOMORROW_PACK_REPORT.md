# DCSS Tomorrow Classroom Pack - 2026-09-14

**K, 2, 4 and 5 support complete games. Grades 1 and 3 remain blocked by Social Studies evidence/quality gaps.**

Cutoff: September 13, 2026. Acceptance is automated checks plus assistant editorial review authorized for this pack, not human teacher approval. The 211 long-term drafts remain pending and saved teacher decisions are not rewritten.

| Grade | New candidates | Total evaluated | Accepted | Tiles | Result |
|---|---:|---:|---:|---:|---|
| K | 18 | 54 | 30 | 30/30 | READY |
| 1 | 16 | 47 | 28 | 28/30 | BLOCKED |
| 2 | 18 | 54 | 30 | 30/30 | READY |
| 3 | 15 | 51 | 27 | 27/30 | BLOCKED |
| 4 | 18 | 54 | 30 | 30/30 | READY |
| 5 | 18 | 54 | 30 | 30/30 | READY |

103 new candidates were compared with 211 existing drafts (314 total). Retained 175; rejected or left out 139. Every candidate retains its selection reason. No generation toward 60 per grade.

## Exact missing pools

- First grade: Social Studies — one 2-point and one 3-point question. Additional candidates repeated supported city/state/nesting tasks or lacked factual detail.
- Third grade: Social Studies — one each at 1, 2 and 3 points. The named-feature source set does not supply enough readable explanatory evidence for the additional proposed questions.
- Incomplete launches remain disabled. Review shares the question pool and cannot substitute for required Social Studies tiles.

## Provenance and limits

- New text snapshots: `content/sources/tomorrow-*.json`. Actual retrieved district hyperlinks/smart chips: `content/tomorrow/verified-source-links.json`.
- Supplemental notes verify facts within an already-supported grade/topic; they do not move other topics into that grade’s schedule.
- Math problems, reading passages and practice weather observations are original skill exercises, not asserted real measurements or invented geographic facts.
- Accepted records retain primary curriculum IDs, dates, standards/session and evidence. Factual verification excerpts retain URLs and character offsets.
- Automated checks verify provenance, timing, schema, length and coverage. Assistant editorial review also checks answers, natural wording, difficulty and semantic repetition; this is not independent human certification.

## Source problems excluded from gameplay

- Fourth-grade deck conflates Declaration adoption/signing; those date questions excluded.
- Fifth-grade citizenship deck has an incorrect answer key and oversimplified naturalization rules; excluded.
- Second-grade notes contain advanced teacher-only astronomy and historical biographical text; not treated as current student content.
- Third-grade science source conflicts on advanced rock taxonomy/streak/cleavage; excluded.
- GaDOE Kindergarten lesson 1449 retrieval was blocked by its web security gateway.
- First/third-grade geography remains short of distinct supported questions; no category substitution or filler.

## Use and rebuild

Select Everything Taught So Far through September 13. Recent Content remains narrower and may not cover a board.
Run `npm run content:tomorrow` to validate/rebuild `src/data/tomorrow-pack.json` from `content/tomorrow/candidates.json`. Rejected alternatives are kept outside gameplay.
Teacher Tools continues using the separate draft bank. Prior teacher rejection/Needs Review on an actually reused draft remains a veto. New questions do not inherit unrelated template decisions.

[Five questions per grade, with answers](TOMORROW_SPOT_CHECK.md)


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
