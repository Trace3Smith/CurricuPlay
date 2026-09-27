# Increment 2 review record

Date: September 27, 2026. Branch: `classthread-resources-curriculum`.
Base checkpoint: `8e481721c8298a7146ace1b24865743adba20f82` (approved Increment 1 live-verification documentation).

Increment 2 passed the user's manual review against the live ClassThread Development Supabase project. The user approved committing and pushing this increment on `classthread-resources-curriculum` after final validation. Main, production, and FantasyEdge infrastructure were not modified. `.env.local` remains ignored by `.gitignore` and absent from the tracked-file list; no credentials, keys, OAuth secrets, environment-file contents, or private configuration values are included in documentation.

## Delivered

Private resource creation, edit/search/filter, assignment association, upload/bookmark originals and version history; bounded CSV/spreadsheet-snapshot ingestion with cell citations; literal extracted assertions and explicit uncertainty/conflicts/missing fields; persisted teacher Keep/Exclude reviews; immutable approval; exact curriculum-version activation with assignment locking and append-only history; active and scheduled curriculum on My Classroom. The original's upload-time source metadata is preserved separately from editable library metadata.

Authority is declared by purpose. No global source ranking, inferred standard alignment, generated instructional suggestions, automatic curriculum claims, lesson generation, or deferred external integrations were added. Effective-period cutovers do not mutate historical records. No Games state or content is migrated.

## Verification

After the successful live manual review, the complete validation suite was rerun on September 27, 2026 before checkpointing. All 152 tests passed, including every original Games regression. TypeScript, the production build, both content validators, and the 1920×1080 layout checks passed. The working tree matched the 33-file manifest below; protected Games/content files and the Increment 1 migration remained unchanged.

| Check | Result |
| --- | --- |
| Final post-approval Playwright suite, four workers | **152 passed** (129 baseline + 23 added), including the original 98 game regressions |
| Added Resources tests | 7 database/RLS, 7 ingestion/domain, 3 provider/service, 6 browser/API workflows |
| Final stale-edit form recovery follow-up | All 6 Resources browser/API tests passed |
| TypeScript and production build | Passed in the final post-approval validation run |
| Curriculum/question content validator | Passed: 755 curriculum records, 737 dated / 18 unresolved; 211 drafts; no errors or warnings |
| Four Corners content validator | Passed: 264 questions, no errors, zero unreviewed changes |
| Legacy importer extraction refactor | All four generated outputs byte-for-byte equal to the prior importer, compared in a temporary copy |
| Git whitespace check | Passed |

The only existing test change removes Resources from the **future placeholders** list, because it is now a real protected page. No game assertions were weakened or removed. The 23 new tests exercise ownership, RLS, Storage path isolation, source/version links, frozen metadata/proposals/reviews, draft revisions, activation rules, superseded history, malformed input, unsupported formats, unsafe bookmarks, changed-source integrity failures, storage failure, assignment switching, refresh persistence and the actual checked-in DCSS snapshot upload/download.

The final form recovery refinement keys an open metadata editor to its persisted revision: after a stale-save conflict, Reload resources refreshes the form fields as well as the revision token. Its browser regression verifies that stale text cannot silently inherit a new revision.

Database tests execute both actual migrations under authenticated and anonymous roles in local PostgreSQL via PGlite. The fixture emulates Storage metadata/RLS and stores private test bytes locally; provider tests separately exercise the installed Supabase SDK's authenticated Storage transport and RPC boundary with mocked HTTP. The user also confirmed successful live Increment 2 Storage/database verification, documented below. The previous Increment 1 Google/Supabase smoke test remains recorded separately in the Increment 1 documentation.

Both content validators ran in a temporary copy, so their report-writing behavior did not alter checked-in reports. The legacy importer comparison likewise ran in temporary copies. Its four matching outputs were `src/data/curriculum.json`, `src/data/questions.json`, `src/data/replacementQuestionIds.json`, and `content/reports/source-issues.json`. The Four Corners report's historical `originalItemsUnchanged: false` reflects its pre-existing approved quality audit; Increment 2 did not edit its bank, audit, or report.

## Live development manual review

The user confirmed that this complete workflow passed against **ClassThread Development Supabase**:

1. Uploaded a resource and confirmed the private original was preserved.
2. Confirmed resource metadata and the Teaching Assignment association persisted.
3. Explicitly mapped CSV rows and columns and extracted assertions with exact source-cell citations.
4. Confirmed uncertainty was preserved without invented dates.
5. Reviewed every assertion and approved the curriculum review.
6. Activated the exact reviewed Curriculum Version for the Sweetwater Elementary Teaching Assignment.
7. Confirmed My Classroom displayed the active curriculum and effective period.
8. Used **View curriculum & source** to return to the correct reviewed source.

Live Supabase Storage and database persistence are therefore verified for the Increment 2 vertical slice. This is the user's reported manual result, distinct from the automated fixture/provider tests. It does not claim a production deployment or live multi-account isolation testing. The configured development project does not need its migration or bucket recreated.

## Layout and Games preservation

The full suite retained its 1920×1080 viewport and gameplay overflow/layout checks, including all-grade Jeopardy, Classic and Team Four Corners, twelve teams, longest text/visuals, movement timer, fullscreen, score commit semantics, history calculations, recovery and teacher vetoes. New Resources tests also check 1920×1080 and mobile horizontal fit.

Generated screenshots were inspected for the Games landing Continue labels, Jeopardy board, Four Corners scoring, active curriculum on My Classroom, and the curriculum review page. Screenshot artifacts are ignored under `test-results/` and can be regenerated with the suite:

- `games-continue-1920.png`
- `board.png`
- `team-mode-scoring.png`
- `resources-classroom-1920.png`
- `resources-curriculum-review-1920.png`

The Increment 1 migration, game components, engines, assessment code, localStorage keys/formats, checked-in source artifacts, question banks, source eligibility and public visuals have no diff from the checkpoint. The legacy source adapter extraction is separately verified to preserve its outputs.

## Warnings and review boundaries

The production build succeeds with the existing React Router `use client` directive notices, Zod pure-comment notices, and large legacy Games chunk warning. The Games chunk remains approximately 2.15 MB raw / 174 KB gzip; the ClassThread entry is 416.21 KB raw / 127.34 KB gzip. Playwright emits the environment's `NO_COLOR`/`FORCE_COLOR` notice. These do not fail validation.

The first ingestion slice supports UTF-8 CSV and spreadsheet cell JSON only, maximum 2 MiB. It does not parse PDF/DOCX/XLSX or connect to Drive. Bookmarks do not preserve remote page contents. Cross-document conflict detection, multi-source reconciliation, official standards verification, lesson generation, same-date/backdated activation corrections, cancellation, sharing, resource deletion, orphan cleanup, user quotas and search indexing remain deferred. A failed database commit after upload may leave an unreferenced private object; no existing original is overwritten. These limits are described in the [setup and workflow guide](INCREMENT_2.md).

## Development setup and local routes

The existing **ClassThread Development** setup is complete and live-tested. Do not reapply its migration or recreate its bucket. For a new environment, `supabase/migrations/202609270001_resources_curriculum.sql` creates the eight tables and private Storage bucket/policies; the bucket is restricted to CSV/JSON and 2,097,152 bytes. No new environment variables or Google scopes are required. See the [Supabase setup reference and manual walkthrough](INCREMENT_2.md#configure-the-development-supabase-project).

- Real development Resources: `http://localhost:5173/resources`
- Real My Classroom: `http://localhost:5173/classroom`
- Explicit local fixture Resources: `http://127.0.0.1:5174/resources`
- Games: `http://localhost:5173/games`
- Jeopardy: `http://localhost:5173/games/jeopardy`
- Four Corners: `http://localhost:5173/games/four-corners`

Both local servers were left running for review: the normal application on port 5173 and the explicit fixture on port 5174. Resource detail/review URLs contain IDs returned by the application. Start with `tests/fixtures/resources/review-table.csv` and columns B (Topic) / C (Instructional window), rows 2–3. The guide also gives exact KINDER/C17/P17 settings for the real DCSS provenance check. No migration to main, production deployment, or next increment is authorized by completing these local checks.

## Exact changed-file manifest

12 modified files; 21 added files relative to the approved Increment 1 checkpoint.

### Modified

- `scripts/ingest-content.py`
- `server/app.ts`
- `server/ports.ts`
- `server/providers/supabase/database.ts`
- `server/providers/supabase/index.ts`
- `src/app/Router.tsx`
- `src/app/class-thread.css`
- `src/modules/classroom/MyClassroom.tsx`
- `tests/fixtures/database.ts`
- `tests/fixtures/provider.ts`
- `tests/foundation.spec.ts`
- `tsconfig.json`

### Added

- `docs/INCREMENT_2.md`
- `docs/INCREMENT_2_REVIEW.md`
- `scripts/source_adapters/dcss_fy27.py`
- `server/ingestion/tabular.ts`
- `server/providers/supabase/resources.ts`
- `server/resources/ports.ts`
- `server/resources/service.ts`
- `shared/contracts/resources.ts`
- `src/modules/resources/ActiveCurriculum.tsx`
- `src/modules/resources/CurriculumImport.tsx`
- `src/modules/resources/CurriculumReview.tsx`
- `src/modules/resources/ResourceDetail.tsx`
- `src/modules/resources/ResourceForm.tsx`
- `src/modules/resources/Resources.tsx`
- `src/modules/resources/useResources.ts`
- `supabase/migrations/202609270001_resources_curriculum.sql`
- `tests/fixtures/resources/review-table.csv`
- `tests/resources-database.spec.ts`
- `tests/resources-ingestion.spec.ts`
- `tests/resources-provider.spec.ts`
- `tests/resources.spec.ts`
