# Verification — September 13, 2026

## Imported content

`npm run content:validate` passed for **755 curriculum records and 108 question drafts**. Checks include source-cell fidelity, unique IDs, required fields, instructional dates, source evidence, question lengths, K/1 teacher-read metadata, duplicates and near-duplicates. Detailed findings: `content/reports/validation.json` and `content/reports/IMPORT_REPORT.md`.

The import includes 737 dated curriculum records, 18 unresolved dates and 613 future planned records. No generated question or aligned question week is later than September 13, 2026. Undated records are excluded from date-based curriculum filtering.

## Application

`npm test -- --workers=2` — **15 passed (26.9s)** in Chromium.

- The original 11 flow tests passed, including six complete 30-tile synthetic games, K/1 teacher-read messages, randomization, no repeats, reset/cancel, Home/resume, Change Grade, refresh before/after reveal, missing/exhausted pools and corrupt/unavailable storage.
- Every one of the **108 real generated drafts** was opened, revealed and checked for exact answer rendering, no repeats and 1920 × 1080 viewport/inner-content fit. This used six 18-question games with approval simulated only inside the test browser.
- No browser console errors in the actual-draft rendering test or six synthetic grade-flow tests.
- Pending-review questions cannot start a game. Refresh cannot restore a question returned to pending status.
- Real curriculum lookup excludes future and undated entries. Recurring aligned weeks preserve introduction dates and support Recent Content filtering without duplicating question records.
- Generated-content screenshots for K, grade 1 and grade 5 were visually inspected. Screenshots for all six grades are in `test-results/real-grade-*.png`.

`npm run build` passed (TypeScript and Vite production bundle). `git diff --check` passed.

## Limits

No teacher has yet approved these drafts. All 108 remain pending in the shipped JSON; tests did not alter that status. Source evidence checks prove traceability, not educational correctness. No grade has 30 distinct questions yet, and Recent Content has gaps. The application and ingestion mechanisms are verified; a fully populated classroom-ready question bank is not claimed.
