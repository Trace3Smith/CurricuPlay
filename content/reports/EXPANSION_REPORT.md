# Content expansion and review pass

Cutoff: September 13, 2026. Added 108 drafts using previously mapped literal skills in the pacing guide’s directly linked district documents. All previous 108 question records are unchanged. No outside source or future instruction was added.

| Grade | Added | Generated | Approved | Pending | Rejected | Recent drafts |
|---|---:|---:|---:|---:|---:|---:|
| K | 18 | 36 | 0 | 36 | 0 | 24 |
| 1 | 18 | 36 | 0 | 36 | 0 | 30 |
| 2 | 18 | 36 | 0 | 36 | 0 | 12 |
| 3 | 18 | 36 | 0 | 36 | 0 | 12 |
| 4 | 18 | 36 | 0 | 36 | 0 | 18 |
| 5 | 18 | 36 | 0 | 36 | 0 | 24 |

These decision counts describe source JSON only. Existing browser-local decisions are preserved and shown in Question Review; they cannot be inferred from source files.

## Coverage in each grade

| Subject | 1 point | 2 points | 3 points | Total |
|---|---:|---:|---:|---:|
| Literacy | 4 | 4 | 4 | 12 |
| Math | 4 | 4 | 4 | 12 |
| Science | 2 | 2 | 2 | 6 |
| Social Studies | 2 | 2 | 2 | 6 |

Review shares the above questions; it adds no unique records. Across all grades: Literacy 72, Math 72, Science 36, Social Studies 36; each difficulty has 72.

## Shortages and teacher decisions

- All 216 source drafts still require review; 68 require classroom materials or teacher checking. The bank is ready for review, not certified classroom-ready.
- Each grade is at least 24 supported drafts below 60, assuming every current draft is approved. Actual source-file approval shortage is 30 for the minimum / 60 for the target per grade.
- With simulated approval, every grade completes a 30-tile subject-first game in Everything Taught So Far. Arbitrary tile order is not guaranteed: Review can consume the limited Science/Social Studies pools before their subject tiles. Additional balanced coverage is needed.
- Recent Content has category gaps in every grade, even grade 1 with 30 recent drafts. The exact grade/category/difficulty matrix and shortages are in [validation.json](validation.json). No dates were shifted to fix coverage.
- 706 curriculum records have no attached question evidence: 613 future planned records, 75 dated through the cutoff, and 18 unresolved dates. The 49 partially supported records still contain other unresolved references. Full inventory: [curriculum-review.csv](curriculum-review.csv).
- K math September 7 conflicts between primary Unit 1 and linked Unit 2; grade 3 math September 7 conflicts between primary multiplication and linked Unit 1 assessment. Neither conflict was used to generate new questions. Other source problems remain in [source-issues.json](source-issues.json).

## Current dated records still lacking question evidence

| Record | Week | Raw source references |
|---|---|---|
| dcss-fy27-K-math-r10 | 2026-08-03 | U1: K.GSR.8.2 |
| dcss-fy27-K-social-studies-r10 | 2026-08-03 | SS1 SSKCG1 |
| dcss-fy27-K-literacy-r11 | 2026-08-10 | Heggerty week 1; U1: Sessions 3-7; ABC Boot Camp, U1W1 |
| dcss-fy27-K-literacy-r12 | 2026-08-17 | Heggerty week 2; U1: Sessions 8-12; ABC Boot Camp, U1W2 |
| dcss-fy27-K-social-studies-r12 | 2026-08-17 | SS1 SSKCG1 |
| dcss-fy27-K-literacy-r13 | 2026-08-24 | Heggerty week 3; U1: Sessions 13-17; Unit 1 Week 3 |
| dcss-fy27-K-math-r13 | 2026-08-24 | U1: K.GSR.8.2 |
| dcss-fy27-K-social-studies-r13 | 2026-08-24 | SS1 SSKCG1 |
| dcss-fy27-K-literacy-r17 | 2026-09-07 | Heggerty  week 5; U1: Sessions 23-25; U1W5 |
| dcss-fy27-K-math-r17 | 2026-09-07 | U1: K.GSR.8.2 |
| dcss-fy27-K-science-r17 | 2026-09-07 | Unit 1 SKE1 |
| dcss-fy27-1-literacy-r10 | 2026-08-03 | Get to Know You; U1: Sessions 1-2; U1W1 |
| dcss-fy27-1-math-r10 | 2026-08-03 | U1: 1.NR.2, 1.NR.2.2 |
| dcss-fy27-1-social-studies-r10 | 2026-08-03 | SS1CG2 |
| dcss-fy27-1-literacy-r11 | 2026-08-10 | Heggerty Week 1; U1: Sessions 3-7; U1W1 |
| dcss-fy27-1-math-r11 | 2026-08-10 | U1: 1.NR.2, 1.NR.2.2 |
| dcss-fy27-1-social-studies-r11 | 2026-08-10 | SS1CG2 |
| dcss-fy27-1-literacy-r12 | 2026-08-17 | Heggerty Week 2 ; U1: Sessions 8-12; U1W2 |
| dcss-fy27-1-math-r12 | 2026-08-17 | U1: 1.NR.2, 1.NR.2.2 |
| dcss-fy27-1-literacy-r13 | 2026-08-24 | Heggerty week 3; U1: Sessions 13-16; U1W3 |
| dcss-fy27-1-math-r13 | 2026-08-24 | U1: 1.NR.2, 1.NR.2.2 |
| dcss-fy27-1-social-studies-r13 | 2026-08-24 | SS1CG2, SS1G2 |
| dcss-fy27-1-literacy-r16 | 2026-08-31 | Heggerty Week 4 ; U1: Sessions 17-21; U1W4 |
| dcss-fy27-1-math-r16 | 2026-08-31 | U1: 1.NR.2, 1.NR.2.2 |
| dcss-fy27-1-science-r17 | 2026-09-07 | S1L1.a |
| dcss-fy27-2-literacy-r10 | 2026-08-03 | Getting to Know You; U1: Sessions 1-2; Unit 1 Week 1 |
| dcss-fy27-2-math-r10 | 2026-08-03 | Lesson 0: 2.MP.1-8 |
| dcss-fy27-2-social-studies-r10 | 2026-08-03 | U1: SSIPS |
| dcss-fy27-2-math-r11 | 2026-08-10 | Lesson 0: 2. MP.1-8 |
| dcss-fy27-2-literacy-r12 | 2026-08-17 | Heggerty week 2; U1: Sessions 8-12; U1W2 |
| dcss-fy27-2-social-studies-r12 | 2026-08-17 | U1: SSIPS |
| dcss-fy27-2-literacy-r13 | 2026-08-24 | Heggerty week 3; U1: Sessions 13-16; U1W3 |
| dcss-fy27-2-social-studies-r13 | 2026-08-24 | U1: SSIPS |
| dcss-fy27-2-math-r16 | 2026-08-31 | U1: 2.NR.2.3 |
| dcss-fy27-2-social-studies-r16 | 2026-08-31 | U1: SSIPS |
| dcss-fy27-2-literacy-r17 | 2026-09-07 | Heggerty  week 5 M.    T.     W.    TH.     F.; U1: Sessions 22-25; U1W5 |
| dcss-fy27-2-math-r17 | 2026-09-07 | U1: 2.NR.2.1 |
| dcss-fy27-3-literacy-r10 | 2026-08-03 | U1: Sessions 1-2; Writing Boot Camp, Unit 1 Week 1 |
| dcss-fy27-3-math-r10 | 2026-08-03 | Lesson 0  |
| dcss-fy27-3-science-r10 | 2026-08-03 | Pre-Planning / First Day |
| dcss-fy27-3-literacy-r11 | 2026-08-10 | U1: Sessions 3-7; U1W2 |
| dcss-fy27-3-literacy-r12 | 2026-08-17 | U1: Sessions 8-12; U1W3 |
| dcss-fy27-3-science-r12 | 2026-08-17 | U1: S3E1a |
| dcss-fy27-3-social-studies-r12 | 2026-08-17 | SS3G1, SS3G1a. SS3G1b |
| dcss-fy27-3-science-r13 | 2026-08-24 | U1: S3E1a |
| dcss-fy27-3-social-studies-r13 | 2026-08-24 | SS3G1, SS3G1a. SS3G1b |
| dcss-fy27-3-literacy-r16 | 2026-08-31 | U1: Sessions 19-24; U1W5 |
| dcss-fy27-3-math-r16 | 2026-08-31 | U1: 3.NR.1.1 |
| dcss-fy27-3-science-r16 | 2026-08-31 | U1: S3E1a |
| dcss-fy27-3-math-r17 | 2026-09-07 | ★ UA-1  /  U2: 3.PAR.3.2 |
| dcss-fy27-3-science-r17 | 2026-09-07 | U1: S3E1a |
| dcss-fy27-3-social-studies-r17 | 2026-09-07 | H1, G3a, E1a, E1b |
| dcss-fy27-4-literacy-r12 | 2026-08-03 | U1: Sessions 1-2; Writing Boot Camp U1W1 |
| dcss-fy27-4-math-r12 | 2026-08-03 | Lesson 0 |
| dcss-fy27-4-science-r12 | 2026-08-03 | S4E4.a, S4E2.b, S4E4.c |
| dcss-fy27-4-social-studies-r12 | 2026-08-03 | Welcome Back  |
| dcss-fy27-4-social-studies-r13 | 2026-08-10 | Unit 1: Connecting Themes |
| dcss-fy27-4-literacy-r14 | 2026-08-17 | U1: Sessions 8-12; U1W3 |
| dcss-fy27-4-math-r14 | 2026-08-17 | U1: 4.NR.1.3 |
| dcss-fy27-4-social-studies-r14 | 2026-08-17 | Unit 1: Connecting Themes |
| dcss-fy27-4-literacy-r15 | 2026-08-24 | U1: Sessions 13-18; U1W4 |
| dcss-fy27-4-math-r15 | 2026-08-24 | U1: 4.NR.1.4 |
| dcss-fy27-4-social-studies-r18 | 2026-08-31 | Unit 2: SS4H1 |
| dcss-fy27-4-literacy-r19 | 2026-09-07 | U1: Sessions 24-27; U1W6 |
| dcss-fy27-4-math-r19 | 2026-09-07 | U1: 4.NR.2.1 |
| dcss-fy27-4-science-r19 | 2026-09-07 | S4E1, S4E2, S4P1.c |
| dcss-fy27-4-social-studies-r19 | 2026-09-07 | Unit 2: SS4H1 |
| dcss-fy27-5-math-r9 | 2026-08-03 | Lesson 0  |
| dcss-fy27-5-science-r9 | 2026-08-03 | Intro to Science Practices |
| dcss-fy27-5-social-studies-r9 | 2026-08-03 | Welcome Back  |
| dcss-fy27-5-math-r10 | 2026-08-10 | U1: 5.GSR.8.3 |
| dcss-fy27-5-social-studies-r10 | 2026-08-10 | Connecting Themes |
| dcss-fy27-5-math-r11 | 2026-08-17 | U1: 5.GSR.8.3 |
| dcss-fy27-5-social-studies-r11 | 2026-08-17 | Connecting Themes |
| dcss-fy27-5-math-r16 | 2026-09-07 | U1: 5.NR.2.1 |

## Verification

Every curriculum record and question passed source/metadata/date/duplicate/length validation. Nineteen Chromium tests passed (47.1 seconds), including all 216 rendered questions, six real 30-tile subject-first games, synthetic Review-first games, local review decisions/edits, refresh, no repeats and future exclusion. Production TypeScript/Vite build passed with a nonfatal bundle-size advisory. Question Review and gameplay screenshots were visually inspected at 1920 × 1080.

Review the drafts in Home → Teacher tools · Question Review. Approve unchanged wording, or edit the fields and use Edit & Approve. Needs Review and Reject save locally and exclude the question from gameplay. No accounts, database, visual redesign, or live AI was added.
