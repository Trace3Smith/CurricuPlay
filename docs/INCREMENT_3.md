# Increment 3 — Lessons + Teaching Memory

Implemented on `classthread-lessons-memory`. **Final manual review passed against the live ClassThread Development Supabase project, as confirmed by the user.** The approved delivery is a commit and push of this branch only after final validation. No merge to main, production deployment, or Increment 4 work is included. No FantasyEdge files or infrastructure are involved.

## Successful live manual verification

The user verified the complete workflow in the real application connected to ClassThread Development:

- Created **Four Corners Academic Review**, saved Version 1 as Ready, and confirmed the exact active Curriculum Version and Resource Version/original were preserved.
- Scheduled the lesson and saw it on My Classroom. Planned uses and actual taught records remained distinct.
- Marked Version 1 taught, saved a **2/5** Teaching Memory reflection, and confirmed persistence after refresh.
- Saw the low-rating warning before revising/reusing the original lesson. Version 2 contained the revised instructional content while Version 1, its taught history and reflection remained intact.
- Created a reusable copy with preserved lineage and separate Teaching Memory. After the identity correction migration, it had no inherited reflection or false low-rating blocker and could be scheduled normally.
- Scheduled the copy once and confirmed exactly one Planned use appeared. Revisited the original and confirmed its existing history and reflection were unchanged.
- Confirmed the manual-review feedback fix: reflection success/error feedback is inline with the form, unsaved reflection text is retained on failure, and Planned/Taught use labeling is clearer.

Both `202609270002_lessons_memory.sql` and `202609270003_lesson_memory_identity.sql` were applied and verified in live Development by the user. This records user-performed verification; automated browser/database checks remain separately documented in the [final review report](INCREMENT_3_REVIEW.md). No credentials, private configuration, or reflection text is included in this record.

## Model and schema

New migration: `supabase/migrations/202609270002_lessons_memory.sql`. The Increment 1 and Increment 2 migrations are unchanged. Apply Increment 3 after those two migrations.

Lineage correction: `supabase/migrations/202609270003_lesson_memory_identity.sql` replaces two functions after Increment 3. It scopes Teaching Memory gating to each lesson's own identity and changes no historical rows or tables. The already-applied Increment 3 migration is unchanged.

| Table | Meaning and mutability |
| --- | --- |
| `lessons` | Stable reusable identity, workspace, original Teaching Assignment, creator, optional `copied_from_version_id`, optimistic revision. Identity and lineage cannot change. Revision advances when a new version is saved. |
| `lesson_versions` | Immutable teacher-authored snapshot: title, assignment ID and descriptive snapshot, ordered optional sections, readiness, exact curriculum binding/version/node references, manual standards references, source lesson version, creator and save date. Every save, including a draft, inserts a new row. |
| `lesson_resource_links` | Immutable links between one saved lesson version and exact private Resource originals. |
| `lesson_occurrences` | Immutable scheduled use: exact lesson version, explicit Teaching Assignment and snapshot, calendar date, creator, low-rating acknowledgement. No automatic “taught” status. |
| `teaching_records` | One immutable actual teaching record per occurrence, with teacher-entered actual taught date and creator. Its occurrence resolves to the exact version that was taught. |
| `lesson_reflections` | Rating and teacher notes on one teaching record. Notes/rating are editable with optimistic revision; identity, creator and taught-record reference cannot change. Reuse never edits or copies this row. |

Relationships:

```text
Lesson → many immutable saved versions
Saved version → exact curriculum binding/version → source version → original Resource version
Saved version → exact attached Resource versions
Saved version → many scheduled uses → at most one actual taught record per use → one reflection
New revision → source saved version
New reusable copy → source saved version (provenance only; separate Teaching Memory)
```

There is no mutable lesson-content draft row or publish operation in this increment. **Save lesson version** creates an immutable snapshot. `draft` and `ready` describe the teacher's readiness judgment; both are immutable once saved. To change content or readiness, use **Revise lesson** and save again. A revision may start from any prior version of the same lesson. A stale aggregate revision cannot replace or append over another tab's save without reload.

The original assignment on a Lesson stays fixed. Each saved version and occurrence separately records the selected assignment and its title, subject, course, grades, teaching role, school year, school, and schedule notes. Switching the workspace header filters the classroom; it never changes those records. A future assignment-renaming UI must display historical snapshots when describing historical uses.

## Universal authoring structure

The six optional section groups are Alignment, Preparation, Instruction, Learner support, Assessment & closure, and Teacher-only notes. All requested fields are available; only title and Teaching Assignment are required to save. Curriculum, sections, Resources and manual standards references are optional.

Each section contains `kind`, teacher-facing `label`, `content`, and `audience`. The section array preserves ordering. Namespaced kinds such as `role.cte.shop_safety` are accepted for future Role Packs; existing custom sections survive revisions even though this first editor only exposes the standard optional fields. There are no PE, grade-band, state, traditional-classroom, or subject-specific branches in the core.

Preparation/private notes must use `audience: teacher`; SQL and request validation enforce this. All lessons remain private to their teacher's workspace, including sections marked `instruction`. Audience is a future view hint, **not a sharing permission**. A future substitute view can select instruction sections (directions, materials, setup, safety, routines, transitions) together with occurrence date and assignment schedule, while excluding teacher notes. No substitute account, public share, or substitute workflow is implemented.

No AI service, prompt, generated lesson content, standards expansion, success criteria, differentiation, evaluation evidence, or automated lesson changes are included. Empty sections stay empty. Ready means reviewed by the teacher, not verified alignment.

## Curriculum and Resources

New lessons use the currently active curriculum for the selected assignment when available, evaluated using the teacher's timezone. The server derives the date; clients cannot choose an arbitrary historical “active” date. SQL locks the selected assignment while validating the exact active binding/version against the submitted references, serializing with curriculum activation. A curriculum replacement while the editor is open produces a conflict instead of silently saving the wrong reference.

The teacher may select reviewed curriculum source rows. The editor displays only accepted assertions, source cells and source uncertainty. SQL rejects unknown nodes and nodes containing no accepted assertions. Manual standards references are explicitly unverified. A curriculum reference identifies context; it does not certify that the teacher-authored lesson aligns with it.

When revising/copying, the teacher can explicitly retain the source lesson's curriculum reference or select the currently active curriculum. Retention requires the exact source version's binding/version and the same Teaching Assignment. Changing the assignment selects its active context and clears old node selections. Old lesson snapshots always keep their original references, including after a curriculum activation expires or is superseded.

Resource attachments choose a specific original from the teacher's private library. Editing Resource metadata or adding a new original cannot change a prior lesson's attachment, file bytes, or displayed upload-time title. Saved lessons provide a download of the pinned original and a link to Resource history. HTTPS bookmarks pin their URL; their remote contents are not captured. No additional Storage bucket or upload format is introduced.

## Scheduling and Teaching Memory

The teacher chooses a saved version, date and Teaching Assignment. Dates must fit the assignment. The scheduled assignment can differ from the version's original context; the UI calls out that distinction and advises revising/copying if different curriculum references are needed. The version's curriculum does not change just because it is scheduled elsewhere. Both drafts and ready versions can be scheduled, and their readiness is always visible.

Scheduling inserts a Planned use only. **Mark taught** creates the separate teaching record. The teacher can enter a different actual taught date from the scheduled date; it must fit the assignment and cannot be in the future in the teacher's timezone. An occurrence can be marked taught once. An occurrence identifier prevents replay of the same scheduling submission from adding another row.

After teaching, the teacher can save a 1–5 rating, what worked, what should change, general reflection, and pacing/materials/transition notes. A reflection cannot exist for merely planned work. Reflection editing requires its current revision and does not change its taught version. This increment retains the current edited reflection, not an audit log of every edit to that reflection's wording.

Teaching Memory presents actual taught dates, actual assignment snapshots, version numbers, ratings and notes for the specific reusable Lesson identity. Reusable copies preserve their source-version lineage but start with no taught uses or Teaching Memory. The original lesson keeps its own history. Each copy begins accumulating memory only when its own scheduled uses are marked taught and reflected on.

Any rating of **1 or 2** on the lesson's own taught uses causes a visible warning before scheduling or saving a revision of that same lesson. The teacher must explicitly acknowledge it. Creating a reusable copy requires no acknowledgement of the source's ratings; the copy has no inherited blocker. SQL enforces the same identity boundary independently of browser controls. The lesson is never modified automatically in response to a reflection. Editing an old reflection is an explicit teacher action on that taught record.

## My Classroom and routes

- `/plan`: private lesson library, title search and assignment filter; honest empty state.
- `/plan/new`: manual creation using the selected Teaching Assignment as an initial preference.
- `/plan/<lesson-id>`: latest saved version, curriculum/Resource references, Teaching Memory, scheduling and taught uses.
- `/plan/<lesson-id>?version=<version-id>`: a specific immutable saved version.
- `/plan/<lesson-id>/revise?version=<version-id>`: new revision of the same lesson.
- `/plan/new?copy=<version-id>`: new reusable lesson with lineage to the source.
- `/classroom`: up to three upcoming untaught scheduled uses for the selected assignment, including today, with exact saved-version readiness. Past scheduled uses remain Planned and are counted separately. Taught uses disappear from the upcoming list.

Active Curriculum and Work Queue retain their existing components and behavior. With no upcoming lesson, My Classroom offers a link to Plan; it does not invent lesson content. Games routes and browser persistence are unchanged.

## Security and service boundaries

All six new tables have workspace RLS and authenticated SELECT only. Anonymous access and direct authenticated INSERT/UPDATE/DELETE are revoked. All mutations go through narrow SQL RPCs with fixed empty search paths and identity-derived workspace/creator. Composite foreign keys keep lessons, versions, curriculum, attachments, occurrences and records within the same workspace. Private identity helpers cannot be called by anonymous or authenticated clients.

Immutable-record triggers additionally reject updates/deletes to lesson versions, attachment links, occurrences and taught records. Separate guards protect lesson identity/lineage and reflection context. Saved versions and reflections use row locks with revision checks for concurrent edits. Scheduling and taught creation are atomic; taught records have a unique occurrence constraint.

`shared/contracts/lessons.ts` contains provider-independent types, strict bounded validation and teaching-memory traversal. `server/lessons/` defines the repository port and authenticated use cases. `server/providers/supabase/lessons.ts` owns SQL-row translation and production SDK RPC transport. The existing HTTP boundary still requires authenticated identity, same-origin JSON mutations, bounded bodies, no-store responses and sanitized errors. No service-role key, provider SDK in the browser, OAuth scope, connector, external message, or new browser persistence format is introduced.

## Explicit limits

This is the requested vertical slice. No AI generation, evaluation/TKES UI, calendar/email connector, full roll-forward, presentations, submission, classroom management, student/parent accounts, tutoring, community library, or national content pack is included.

Teaching Groups/periods, occurrence cancellation/rescheduling, deletion, a full calendar, reflection edit audit history, library-wide server pagination, and large-library search indexing are not built. Each scheduled use is preserved; if its actual taught date differs, record that actual date when marking it taught. Multiple uses can share an assignment/date. A production scale-up should add paginated library/detail reads; this slice returns the teacher's private library, with bounded per-save payloads.

Unsaved editor text is held in component memory, not browser storage. Save a draft before navigating away. A rejected save preserves the form; **Reload lessons** deliberately reloads records and resets the editor so stale references/revisions can be reviewed. If saving succeeds but refresh fails, the UI reports that it was saved rather than inviting an accidental repeat.

## Supabase migration status

The existing Increment 1 and Increment 2 development setup stays intact. **Both Increment 3 migrations are already applied and manually verified on the reviewed ClassThread Development project; no reapplication is required.** For another database with only the initial Increment 3 migration, apply only `supabase/migrations/202609270003_lesson_memory_identity.sql`. For a new database, apply the migrations in order, including `202609270002_lessons_memory.sql` before the correction. Do not reapply existing migrations or recreate their Storage bucket. The correction transaction replaces only `private.lesson_low_rating` and `public.save_lesson`; existing tables, historical rows, RLS and permissions are preserved. The application does not apply remote migrations automatically.

Keep `public` exposed to PostgREST and `private` unexposed, as before. No new environment variables, credentials, storage policies, buckets, Google scopes or integrations are required. Do not use a service-role key in place of the existing publishable key.

Both migrations are tested with their actual SQL under PostgreSQL/PGlite authenticated and anonymous roles. Production Supabase SDK transport is separately tested with mocked HTTP. The successful live Development verification above was performed and confirmed by the user. The agent did not apply remote migrations.

## Exact local manual review

Real development backend: **http://localhost:5173/sign-in**, **http://localhost:5173/plan**, **http://localhost:5173/classroom**, **http://localhost:5173/resources**. Start/restart it with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` if needed. Use `localhost` to match the existing configured request origin.

1. Confirm the Increment 3 migrations described above are applied; they are already verified on the reviewed Development project. Sign in with your existing account. Select a school year and Teaching Assignment. Confirm its active curriculum still displays in My Classroom and its existing Work Queue is intact.
2. Open **Plan → Create a lesson**. Enter a title. Confirm **Lesson Teaching Assignment** and the active curriculum label. Expand **Choose curriculum topics / source rows** and optionally select a reviewed source row; inspect its cell citations.
3. In **Attached Resources**, choose an existing Resource's **Original 1** (or another explicit original). Write a learning target or other relevant sections yourself. Optional groups expand individually; leave irrelevant sections blank. Set **Lesson readiness** to **Ready · reviewed by me** or leave it Draft. Choose **Save lesson version**.
4. Confirm Version 1 appears, the correct curriculum source is linked, and the Resource points to the original you chose. Download it if it is a file. Refresh; your plan should remain intact.
5. Under **Schedule this version**, select the assignment and today's date (within the assignment dates). Choose **Schedule lesson**. Confirm a **Planned** use appears and no taught reflection exists yet.
6. Open **My Classroom**. Confirm the scheduled title, date, Version 1 and its readiness. Switch to a different assignment and back; the schedule must stay attached to its original assignment. Active Curriculum and Work Queue should continue working.
7. Open the scheduled lesson with **Open / mark taught →**. In **Scheduled & taught uses**, confirm **Actually taught on**, then choose **Mark taught**. Confirm it now says **Taught**. The actual date may differ from the scheduled date, but cannot be in the future.
8. Give this use a rating of **2 / 5** to test the warning. Enter **What worked**, **What should change**, and optional pacing/materials/transition/general notes. Choose **Save reflection**. Refresh or revisit through Plan and confirm the reflection remains on this date, assignment and Version 1.
9. Select **Revise lesson**. Review Teaching Memory. Keep the original curriculum reference or explicitly choose currently active curriculum. Change one section, acknowledge the low-rating warning, and save. Version 2 should appear while Version 1, its taught record and reflection remain unchanged. A revised version starts as Draft until you mark it Ready yourself.
10. Select **Make a reusable copy**. Optionally choose another Teaching Assignment; verify that its current curriculum context is selected. Save without a low-rating acknowledgement. The new lesson has its own identity and Version 1 Draft, preserved source lineage, no taught history, and no scheduled uses. Open the original lesson and confirm both versions and its 2/5 reflection remain unchanged.
11. Schedule the new copy without a low-rating acknowledgement. Confirm a new Planned use is added and the original taught record is unchanged. Scheduling a revision of the original lesson still requires acknowledgement of its own 2/5 rating.
12. Optionally add a new Resource original or activate a later curriculum version through the existing Resources workflow. Open Version 1 again; its original references must be unchanged. On a new revision, explicitly choose the current curriculum if desired.
13. Check a second signed-in account: the first account's lessons, attachments, scheduled uses and reflections must not appear. Open Games and confirm existing Jeopardy/Four Corners progress continues.

For a fully local review without changing cloud state, run `npm run dev:fixture` and use **http://127.0.0.1:5174/sign-in** with an `example.test` email and code **123456**. This is the clearly labeled development fixture, not real authentication/Storage. Restart an older fixture process before testing. Its persisted local foundation/resource records are preserved when applying Increment 3. It does not automatically seed lessons or curriculum. Existing synthetic Resources instructions in `docs/INCREMENT_2.md` can prepare a source if needed.
