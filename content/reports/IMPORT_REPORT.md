# CurricuPlay content import and generation report

Snapshot and generation cutoff: **September 13, 2026**.

Primary source: [DCSS FY27 Pacing Guide](https://docs.google.com/spreadsheets/d/1NHE1-x6b21bcd2f5hEEcm4EZEAv66rty6_paTaPi1yo/edit). All 15 workbook tabs were inspected. Only the six primary K–5 tabs supply instructional timing. Subject-support documents directly linked from those tabs supply explicitly cited skill descriptions; no external standards lookup or model-memory code expansion was used.

## Imported curriculum

- **755 subject-row records**: 737 dated and 18 without a source Week of date.
- The six primary grade tabs each contain 36 numbered instructional weeks. Blank subject cells are not filled from neighboring rows. A record combines the nonempty Literacy columns in a weekly row; other subjects remain separate. Kindergarten’s combined Science & SS column is classified by its explicit code prefix; its original cell text is preserved.
- **613 dated records are future planned curriculum**, not current playable content. Their dates are preserved, never moved earlier.
- **49 records have partial supporting evidence attached.** The remaining 706 have no question evidence attached: 613 future records, 75 dated records through the cutoff, and 18 undated records. Code-only, program-only and unclear references remain explicitly marked as needing additional material. This is an unresolved-work count, not a claim that all linked future lessons lack detail.
- Full row-level inventory: [curriculum-review.csv](curriculum-review.csv). Raw text, codes (including shorthand), unit/session references, source sheet/cell coordinates and source links are retained.

## Generated questions

| Grade | Drafts | Approved |
|---|---:|---:|
| K | 18 | 0 |
| 1 | 18 | 0 |
| 2 | 18 | 0 |
| 3 | 18 | 0 |
| 4 | 18 | 0 |
| 5 | 18 | 0 |

| Subject | Drafts |
|---|---:|
| Literacy | 36 |
| Math | 36 |
| Science | 18 |
| Social Studies | 18 |

| Difficulty | Drafts |
|---|---:|
| 1 point(s) | 36 |
| 2 point(s) | 36 |
| 3 point(s) | 36 |

**Total: 108 drafts, 0 teacher-approved questions.** Review reuses eligible questions from these subjects; it adds no duplicate records.

Questions are original practice examples for an explicit source skill, not purported extracts from a textbook. Every draft has a literal supporting quote, document URL, section, character offset, main-guide record ID, timing and unit/session/standard metadata where supported. Standards missing from the primary sheet are left null unless the linked evidence explicitly supplies them; `standardSource` distinguishes the sources. Null standards are paired with source-supported sessions.

All 108 drafts require teacher review of accuracy, scope and difficulty. **35 questions use a teacher-check rubric or classroom materials.** `teacherSetup` identifies maps, observations, samples or other necessary materials. The app displays these preparation instructions. A teacher-check answer is intentionally a rubric, not a fabricated universal answer. Review worksheet: [question-review.csv](question-review.csv).

## Coverage and limits

**No grade yet supports a full 30-tile game.** Each has 18 distinct drafts, and Recent Content is smaller. Approving drafts does not fix these coverage gaps. The engine disables unsupported/exhausted tiles and shares used IDs across Review and subject categories.

| Grade | Recent drafts | All taught drafts | Current approved |
|---|---:|---:|---:|
| K | 12 | 18 | 0 |
| 1 | 15 | 18 | 0 |
| 2 | 6 | 18 | 0 |
| 3 | 6 | 18 | 0 |
| 4 | 9 | 18 | 0 |
| 5 | 12 | 18 | 0 |

The complete **grade × category × difficulty × range** matrix is in [validation.json](validation.json). `alignedWeeks` records explicitly reviewed recurring instruction while `weekIntroduced` remains the first mapped week. Recent Content checks aligned weeks; both modes exclude future introduction dates and future aligned weeks. Undated records never enter date filters.

## Source issues and unresolved rows

- Kindergarten math: main guide still lists Unit 1 / K.GSR.8.2 on September 7; linked math support starts Unit 2 / K.NR.1.2. September 7 K math was not generated.
- Third-grade math: main guide starts Unit 2 / 3.PAR.3.2 on September 7; linked support uses Unit 1 assessment that week and starts Unit 2 on September 14. No current multiplication questions were guessed from the code.
- FIRST quarter boundaries differ from other grade tabs. Dates and quarter labels are preserved as written.
- Grade 3 social studies contains shorthand such as H1, G3a, E1a, E1b. The import preserves it; no unverified full-code expansion is made.
- Content exists in 18 rows/subject combinations without a Week of value, including break-adjacent and stray writing entries. These have null dates and `needs_timing_review`; see the CSV and [source-issues.json](source-issues.json) for exact coordinates.
- The hidden GrammarPlanning tab contains 2024 dates; K - PA says 2024–2025; Principals Newsletter date labels differ from the main FY27 tabs. They were inspected and excluded from mappings.
- Linked documents contain placeholders, inconsistent standard punctuation, timing conflicts and assessment access codes. Only selected instructional evidence is bundled in the application; full source snapshots stay outside `src/`.
- No question is generated merely from a named book, video, standards code or broad historical topic without an explicit practice skill or teacher-check requirement. Historical facts and book-specific answers were not inferred from titles.

## Validation

- Every one of the 755 curriculum records and 108 questions passed structural/provenance/date validation.
- Zero duplicate IDs, duplicate question texts within a grade, remaining near-duplicate candidates, missing answers, missing required metadata, future questions, or overlength prompts/answers.
- Near-duplicate screening compares normalized text within a grade/subject, replacing numeric literals, at similarity ≥ 0.84. Three initial candidates were rewritten and rechecked. This is a screening heuristic, not proof of semantic uniqueness.
- K/1 prompts include teacher-read metadata and stay within the 30-word screening limit. Prompts are ≤240 characters and answers ≤300; all generated questions also receive actual browser layout checks.
- Automatic checks verify evidence presence and source mappings; they cannot certify that a generated question is educationally correct. That remains the reason for teacher review.

Browser/build results are recorded in [../../VERIFICATION.md](../../VERIFICATION.md).

## Recommended next step

Review the draft worksheet and resolve the two current math pacing conflicts. Confirm which additional linked lesson sections can supply the missing categories, then expand to sufficient unique questions per grade/range before classroom use. For reviewed questions, set `reviewStatus` to `approved` in `src/data/questions.json`; leave all others pending. No account or approval dashboard is needed. Regenerating from the draft source intentionally resets approval to pending.
