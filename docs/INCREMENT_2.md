# Increment 2 — Resources + Curriculum Intelligence

This increment adds a private, persisted resource library and one reviewed tabular curriculum workflow. It does not generate lessons or suggestions. All existing Teacher Foundation and Games behavior remains in place. Increment 2 passed manual review against ClassThread Development and is approved for checkpointing on `classthread-resources-curriculum`.

## Usable workflow

1. Sign in with the existing ClassThread identity and select a Teaching Assignment.
2. Open **Resources**, add resource details, and upload a UTF-8 CSV or spreadsheet cell JSON snapshot (up to 2 MiB). Alternatively, save an HTTPS bookmark.
3. Open the resource to see its source, ownership, assignment associations, original versions, and curriculum reviews. Search the library by title, subject, course, grade, standard label, or tag; filter by resource type or assignment.
4. Select **Prepare curriculum review**. Choose an original, sheet, data rows, column meanings, authority purposes, and an effective period. The applicability dates are teacher declarations, separate from dates copied from cells.
5. Select **Extract for review**. Review every copied statement alongside its original cell citation. Keep or exclude it; save progress at any point.
6. Acknowledge missing information and extraction limits. Explain retained uncertainty and detected conflicts in the review note. Approve the review, then explicitly activate that exact version for an assignment.
7. My Classroom shows the curriculum in effect for the selected assignment and teacher’s current local date, with a future activation shown separately. Switching assignments never relabels a binding.

No fixture resources or tasks are automatically added to a teacher account. `tests/fixtures/resources/review-table.csv` is an explicitly synthetic manual/test fixture.

## Supported ingestion and limits

**One ingestion path: literal, teacher-mapped tables.** CSV and spreadsheet JSON are two decoders for the same tabular adapter. CSV supports quoted commas, escaped quotes, multiline cells, UTF-8 BOM, and CRLF/LF. JSON supports the existing snapshot shape: `sheets[].properties`, `data[].startRow/startColumn`, and `rowData[].values[].formattedValue`. Sheet names, hidden-sheet state, row numbers, and A1 cells remain available. The JSON is a downloaded snapshot, not a live Google connection.

Each nonempty mapped cell produces one assertion with literal text, source sheet/row/cell, a verbatim quote, fixed `extracted` provenance, literal-copy confidence, and uncertainty messages where applicable. The curriculum version reaches the immutable original through `CurriculumVersion → SourceVersion → ResourceVersion`. Each original also freezes its upload-time metadata and SHA-256 digest. No formula executes and no linked document is fetched.

Supported optional meanings are unit, topic, instructional window, sequence, standards references, objectives, essential questions, vocabulary, assessments, resources, notes, and prerequisites/relationships. These are literal text fields, not inferred relationships or verified alignment. Empty cells stay empty. There is no forward filling, inferred school year, code expansion, silent conflict resolution, or instructional generation.

A review supports at most 500 selected rows and 1,500 assertions. Source parsing is bounded by file, row, column, cell, and cell-text limits. Review rows paginate in groups of 15. List responses omit large assertion and decision payloads; full history is read when opening a resource. Library-wide server pagination and a dedicated search index are deferred until needed.

Differing values mapped to the same meaning in a row are flagged as conflicts. Timing that is not an explicit ISO date/range, standards references, and hidden-sheet content require attention. Semantic and cross-document conflicts are **not automatically detected**. The review explicitly discloses this; teachers can retain both values with a note or exclude unsupported content. A sparse extraction is valid. Review approval is a teacher decision, not a claim that the source or standards alignment has been independently verified.

PDF, DOCX, native XLSX, Google Drive/Docs/Sheets connectors, and URL extraction are not implemented. Such files are rejected with an explanation, rather than stored with a misleading extraction status. HTTPS links are bookmarks only: the URL is immutable but the remote contents are not captured. Future adapters belong behind the ingestion boundary and must provide citations and uncertainty; a new format needs its own validation and quality tests. Google authentication still requests identity scopes only.

### Existing DCSS compatibility

The original offline importer now delegates its pinned district/year logic to `scripts/source_adapters/dcss_fy27.py`. The question/evidence/audit pipeline stays in `scripts/ingest-content.py`. The district mapping is confined to that legacy adapter; ClassThread's domain and online adapter have no Georgia, DCSS, PE, grade-band, or evaluation-framework branches.

The actual `content/sources/pacing-guide-cells.json` is accepted by the new importer. Compatibility tests compare all 755 legacy curriculum records and specifically retain the literal KINDER P17 math reference and unresolved timing. The known pacing/support-document discrepancy remains documented in the existing content reports; the new importer does not resolve it by adding unsupported content. Pacing controls the existing Games eligibility exactly as before.

## Schema and service boundaries

New migration only: `supabase/migrations/202609270001_resources_curriculum.sql`. The already-applied `202609260001_teacher_foundation.sql` is unchanged.

Eight application tables:

| Table | Purpose |
| --- | --- |
| `resources` | Workspace-owned, editable library metadata, optional year, revision and timestamps |
| `resource_versions` | Immutable original file/bookmark, number, digest, private object key, and upload-time metadata |
| `resource_assignments` | Workspace-constrained instructional associations; no access grants |
| `curriculum_sources` | Stable curriculum-source identity for a resource |
| `curriculum_source_versions` | Exact original, teacher column mapping, and authority purposes |
| `curriculum_versions` | Immutable extracted proposal, effective dates, label and optional predecessor |
| `curriculum_reviews` | Draft decisions/note with revision; frozen reviewer identity and decisions once approved |
| `assignment_curriculum_bindings` | Append-only exact-version activations and previous-binding chain |

Authority is recorded per source version as a set of purposes: timing, sequence, standard wording, clarification, vocabulary, instructional detail, and methods/materials. It is not a global ranking. Separate sources keep separate reviews; merging multiple source documents into a reconciled curriculum is deferred. There is one primary curriculum activation timeline per Teaching Assignment in this increment.

Version replacement creates new originals and proposals. Approval freezes the review. Activation requires approval, dates within the assignment, and a start date later than its latest recorded activation. A row lock plus expected previous-binding ID prevents concurrent tabs from silently replacing one another. A later activation takes over on its effective start; the older binding remains byte-for-byte unchanged. After a replacement expires, the old version does not silently reactivate. Backdated corrections, same-date replacements, activation cancellation, and future-work impact previews are deferred; use a new reviewed proposal with a later effective start for this increment. Historical work/lessons are not rewritten or retroactively assigned curriculum IDs. Future lesson/work references must pin the exact curriculum version when created.

- `shared/contracts/resources.ts`: provider-independent types, strict input validation, safe bookmark URLs and date-aware binding selection.
- `server/resources/ports.ts`: `ResourceRepository` and private `OriginalStorage` interfaces.
- `server/resources/service.ts`: authenticated use cases, context validation, source hashing/integrity, ingestion/review/activation orchestration.
- `server/ingestion/tabular.ts`: bounded decoders, literal extraction, citations, uncertainty and mapping conflict checks.
- `server/providers/supabase/resources.ts`: Supabase RPC/Storage implementation and row translation. Only provider code imports the production SDK.
- `server/app.ts`: authenticated HTTP routes, same-origin JSON mutations, bounded request bodies, private/no-store responses, authorized attachment downloads.
- `src/modules/resources/`: library, original details, mapping, review, and active-curriculum UI. No provider APIs or new browser persistence formats.

## Privacy and operational behavior

The migration enables RLS on all eight tables, revokes anonymous access, and grants authenticated reads through workspace policies. Mutations use narrowly scoped SQL functions with a fixed search path, identity-derived workspace, foreign-key/relationship checks, revision checks, and atomic transactions. Clients have no direct insert/update/delete grants on these tables. Immutable-record triggers also prevent accidental historical updates. This is personal-workspace authorization; district/school labels confer no membership, sharing, or ownership.

Originals use the private `classthread-resources` bucket and keys of the form `<workspace UUID>/<original UUID>/original`. Insert policies require the authenticated workspace. Read policies require a visible, referenced resource original. There are no user UPDATE/DELETE policies; uploads always set `upsert: false`. The server downloads as the current user, verifies size and SHA-256, and returns an attachment with `no-store`, `nosniff`, and a restrictive content-security policy. No public or long-lived signed download URLs are exposed. Supabase supports authenticated private downloads and RLS-backed access; see [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

File extensions alone are insufficient: the service also validates encoding, structure, size, and parser limits before any upload. Original text is untrusted and rendered as escaped text. Documents cannot request integrations or authorize actions. Downloaded originals retain their original bytes, including any formulas; exercise the normal caution appropriate to untrusted files when opening them in spreadsheet software. URLs permit public-looking HTTPS bookmarks without credentials or custom ports; **no server fetch occurs**, so this is not an SSRF-enabled URL ingestion feature. A future URL fetcher requires separate DNS, redirect, private-address, content and size protections.

No student PII, parent/student access, organization sharing, external actions, AI calls, service-role credentials, or new OAuth scopes are introduced. Browser Games records are never uploaded or claimed.

Object storage and PostgreSQL do not share a transaction. A storage failure creates no library record. A database failure after a successful upload can leave an inaccessible, unreferenced private object; it cannot overwrite an original or activate curriculum. Do not retry ambiguous saves blindly: reload the library first. Administrative orphan cleanup/retention is deferred and must check for a matching `resource_versions.storage_key` before any deletion. There is no deletion UI or new user quota beyond the bounded upload size yet.

## Live development verification

The user confirmed that the complete Increment 2 workflow passed against the real **ClassThread Development Supabase** project, including live Storage and database persistence:

- Resource upload preserved the private original, resource metadata, and Teaching Assignment association.
- Explicit CSV row/column mapping produced assertions with exact source-cell citations. Uncertainty remained visible without invented dates.
- The teacher reviewed every assertion and approved the curriculum review.
- The exact reviewed Curriculum Version was activated for the Sweetwater Elementary Teaching Assignment.
- My Classroom displayed the active curriculum and effective period, and **View curriculum & source** returned to the correct reviewed source.

This records the user's live manual verification separately from the automated PostgreSQL fixture and mocked-provider tests. Live Supabase Storage and database persistence are verified for this vertical slice. See the [review record](INCREMENT_2_REVIEW.md#live-development-manual-review). No credentials, keys, OAuth secrets, environment-file contents, or private configuration values are included.

## Configure the development Supabase project

The existing **ClassThread Development** project has completed setup and passed the live workflow above. The following steps remain a reference for a new environment; **do not reapply the migration or recreate the existing bucket** in the verified project. The application does not apply remote migrations automatically.

1. Leave the verified Increment 1 configuration and migration intact. Apply **only** `supabase/migrations/202609270001_resources_curriculum.sql` once, using the project SQL editor as database owner or the normal migration process.
2. The migration creates all eight tables, constraints, functions, grants, RLS policies, and the Storage bucket. **Do not pre-create the bucket.** If a bucket with that ID already exists, stop and inspect its origin/settings; do not blindly overwrite or delete it. The migration is transactional and deliberately does not use permissive bucket upserts.
3. In Storage, verify bucket `classthread-resources` is **private**, its limit is **2,097,152 bytes**, and allowed MIME types are exactly `text/csv` and `application/json`. Ensure the project's global upload limit is at least this size. See [bucket configuration](https://supabase.com/docs/guides/storage/buckets/creating-buckets).
4. Verify Storage policies `classthread_original_insert` and `classthread_original_read`. There should be no other permissive policies granting public/cross-workspace reads or update/delete access to this bucket. Keep `public` exposed to PostgREST and `private` unexposed; do not disable RLS or add anonymous grants.
5. No new environment variables, credentials, integrations, Google scopes, or browser keys are required. Existing server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `CLASSTHREAD_ORIGIN` remain the configuration contract. Never substitute a service-role key. `.env.local` remains ignored and untracked.
6. Restart the dev server if necessary with `npm run dev -- --port 5173 --strictPort`, then perform the manual workflow below. For a new environment, repeat the live vertical-slice check and verify with two Google/email accounts that originals, reviews, and bindings stay isolated. Two-account isolation is covered by automated tests; it was not part of the reported live manual verification.

No Vercel project or deployment changes are needed for local review. If a later deployment is authorized, the existing Node API route handles these requests; the 2 MiB file limit keeps base64 JSON uploads below the function request limit. Revalidate the target environment's body and execution limits then. No deployment is performed by this increment.

## Exact local review walkthrough

Real backend: **http://localhost:5173/resources**, **http://localhost:5173/classroom**. Resource details use `/resources/<resource-id>`; a review uses `/resources/<resource-id>/review/<curriculum-id>`.

With the Increment 2 migration already applied (as in the verified development project):

1. Sign in at `http://localhost:5173/sign-in`. In Manage, establish/select a school year and assignment whose dates contain the curriculum's intended effective period.
2. In Resources, choose **Add resource**, enter a title and source/publisher name, select type/origin, and optionally label subject/grades/tags and link an assignment.
3. For a quick synthetic test, upload `tests/fixtures/resources/review-table.csv`. Save. Confirm the resource is private and **Download original** returns the same file.
4. Choose **Prepare curriculum review**. For that fixture choose sheet `CSV`, rows **2–3**, column **B → Topic**, and **C → Instructional window**. Check authority purpose **timing** (and any other applicable purpose). Choose effective dates within the assignment, starting on or before today if you want it active immediately. Click **Extract for review**.
5. Confirm B2/B3 copy the source topics, C2 copies an ISO date, C3 retains “September week 2” and an uncertainty notice, and absent objectives/other fields appear under missing information. Choose Keep/Exclude for each cell. Enter a note explaining retained timing uncertainty. Save review progress; refresh and confirm the decisions return.
6. Acknowledge the review limits and choose **Approve curriculum review**. Decisions become read-only. Choose the intended assignment and **Activate for assignment**. Open My Classroom to see the active version and dates. Switch assignments, refresh, sign out/in, and confirm the original context remains intact.
7. Add a second original using **Add new original**. Prepare a new curriculum review from it, select the preceding curriculum in **Revises an earlier curriculum**, and choose a later start date (for example January 1 within the same assignment/year). Approve and activate. Confirm the original download and prior approved decisions remain available; a future start shows as scheduled on My Classroom until its date.
8. Test a saved HTTPS link: it displays as an external bookmark and cannot be extracted without an uploaded snapshot. Unsupported/malformed files should be rejected without creating an empty resource. Test a second account: it must see none of the first account's resources or private downloads.
9. Open `/games`, `/games/jeopardy`, and `/games/four-corners`; continue existing progress and return to ClassThread. Resource work should have no effect on browser game records.

For the real checked-in compatibility example, upload `content/sources/pacing-guide-cells.json`. Choose **KINDER**, row **17** only, **C → Instructional window** and **P → Standards references**. Declare the pacing guide authoritative for **timing/sequence**, not independently verified standard wording. Review the literal P17 value without “correcting” it from a support document. The existing source reports describe that discrepancy. This example is a K math provenance check; it is not a PE curriculum fixture and does not imply the repository contains an elementary PE pacing guide.

For review without cloud changes, run `npm run dev:fixture`, then visit **http://127.0.0.1:5174/resources**. Use an `example.test` email and code **123456**. This is the explicit development fixture with local PostgreSQL/RLS and private local test bytes; it does not use Supabase Storage or real Google. Existing fixture identities and foundation records are preserved when applying the new migration. No source material is auto-seeded. An already-running fixture server must be restarted to load new server code.

See [Increment 2 review results](INCREMENT_2_REVIEW.md) for verification totals and the exact changed-file manifest.
