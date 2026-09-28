# Increment 3: separate copy lineage from Teaching Memory

Branch: `classthread-lessons-memory`. **Final live manual verification passed, as confirmed by the user.** Both Increment 3 migrations were applied and verified in ClassThread Development by the user. The approved delivery is a commit and push of this branch after final validation; no merge or production deployment is included.

## Successful live review

The user confirmed that the reusable copy retained its source lineage while showing no taught history or inherited reflection. After applying `202609270003_lesson_memory_identity.sql`, the false low-rating blocker disappeared and the copy could be scheduled normally. Scheduling it once produced exactly one Planned use. Revisiting the original **Four Corners Academic Review** confirmed Version 1/Version 2, the original taught history and its 2/5 reflection were unchanged. The original lesson continued to surface its own low-rating warning. This verifies the correction against live Supabase, separately from the automated local tests below.

## Root cause and correction

The application did not copy any teaching records. Instead, `teachingMemory` recursively followed `copiedFromVersionId`, treating source lessons' taught records as part of the copy's memory. `hasLowRating` consumed that result. The SQL helper `private.lesson_low_rating` independently traversed the same ancestry, so hiding the browser warning alone would still leave scheduling blocked. Finally, the copy editor and `save_lesson` checked the source identity when creating a new reusable copy.

Teaching Memory and low-rating gating now use only the Lesson identity whose version was actually scheduled and taught. Revisions of A still see A's feedback across its saved versions. B keeps its source-version lineage but starts with empty Teaching Memory and requires no acknowledgement to create or schedule. If B is later taught and rated 1 or 2, B gains its own warning. Another copy C starts independently again. No source-feedback informational panel was added.

## Verified database correction

The user applied and verified `supabase/migrations/202609270003_lesson_memory_identity.sql` after `202609270002_lessons_memory.sql` in **ClassThread Development**. Nothing needs to be reapplied to that project. For another database that already has the initial Increment 3 migration, apply only the correction. The application does not apply remote migrations.

This forward migration replaces two function definitions: the rating helper and the existing save RPC. The save function body changes only its rating-check identity, from the existing lesson or source to the existing lesson alone. It preserves all ownership checks, exact references, concurrency checks, grants, RLS, lineage fields and immutable records. It changes no tables or historical rows. Existing copies are corrected immediately; they do not need to be recreated.

The applied migration was not edited. Its SHA-256 remains:

```text
5b567199a2e5c6ba14fa8f40cca27a9b13ee70f57b608fd51a04f834cb337a35  202609270002_lessons_memory.sql
```

## Regression evidence

Two new regressions failed before the fix:

- PostgreSQL/shared-contract test: B returned A's reflection, B's low-rating check returned true, and scheduling B without acknowledgement raised `P0001`.
- Browser test: the reusable-copy editor displayed A's Teaching Memory and required its acknowledgement.

Both pass after the fix. The new database test also verifies that B's own later 1/5 feedback gates B, leaves A unchanged, and does not gate a descendant copy C. A third new test recreates the prior function definitions in an isolated local database, seeds A with two versions plus a reflection and an existing copy B, then applies the forward migration. It verifies every returned lesson/history row and the function owners/grants are identical before and after, B becomes schedulable, A remains gated, and another workspace still sees no records.

Existing acceptance tests were updated to the requested copy semantics. Test dates now match the bootstrapped teacher's New York timezone; this avoids attempting to mark tomorrow taught during the hours after UTC midnight. No production date handling changed.

## Final verification

- Full suite: `npx playwright test --workers=2` — **177 passed (3.4m)**, including the original **98 Games regressions**. Three new tests were added in this correction (174 → 177).
- TypeScript: `npm run typecheck` — passed.
- Production build: `npm run build` — passed. Only existing React Router module-directive, Zod purity-annotation and legacy Games chunk-size warnings remain.
- Content validator: `npm run content:validate` — passed; 755 curriculum records, 211 question drafts, no errors or warnings.
- Four Corners validator: `python3 scripts/validate-four-corners.py` — passed; 264 records, no errors, zero unreviewed changes.
- Browser checks ran at 1920×1080. `test-results/lessons-copy-separated-memory-1920.png` was inspected: B shows empty Teaching Memory, Draft readiness and an enabled Schedule button with no inherited warning. No page errors or horizontal overflow in the new workflow.
- `git diff --check` — clean. The applied migration checksum is unchanged. A direct comparison also confirmed that the replacement save RPC differs only in the intended rating-check identity.

No Games implementation, content banks, Resources/Curriculum implementation, authentication implementation or existing migration was changed by this correction.

## Files changed in this correction

- `shared/contracts/lessons.ts`: filter Teaching Memory by exact Lesson identity.
- `src/modules/lessons/LessonEditor.tsx`: source feedback/acknowledgement applies to revisions, not creation of a new reusable copy.
- `src/modules/lessons/TeachingMemory.tsx`: remove the now-unreachable inherited-memory presentation.
- `supabase/migrations/202609270003_lesson_memory_identity.sql`: forward function correction.
- `tests/fixtures/database.ts`: apply the idempotent correction to new and existing local fixture databases.
- `tests/lessons-database.spec.ts`: identity separation and existing-data migration regressions; update old copy expectations.
- `tests/lessons.spec.ts`: complete 1920×1080 A → reflection → B → schedule regression; update copy acceptance expectations.
- `docs/INCREMENT_3.md`: corrected model and manual migration/review instructions.
- `docs/INCREMENT_3_REVIEW.md`: point the initial review report to this correction.
- `docs/INCREMENT_3_LINEAGE_REVIEW.md`: this report.

## Exact manual retest

1. Confirm both migrations above are applied; they are already verified in the reviewed **ClassThread Development** project. Do not reapply or edit them.
2. Refresh `http://localhost:5173/plan` and open the original lesson A. Confirm its Version 1 and Version 2 still exist, its taught use retains the 2/5 reflection, and its Schedule section still requires acknowledgement.
3. Open the already-created reusable copy B. Confirm Version 1 Draft, its source-version link, **No taught history yet**, **No uses scheduled yet**, and no prior-use rating warning. **Schedule lesson** should be enabled without an acknowledgement checkbox.
4. Schedule B for a valid date and Teaching Assignment. Confirm one Planned use appears. Scheduling must not mark it taught or create a reflection.
5. Refresh, reopen A and confirm both versions, its taught occurrence, assignment context and exact 2/5 reflection remain unchanged.
6. Optionally make a fresh reusable copy from A Version 1 or Version 2. Save without acknowledging A's feedback, then confirm the new copy also starts with empty Teaching Memory and no low-rating blocker.

Live verification was performed and confirmed by the user. Automated database and browser checks use local PostgreSQL/PGlite and the explicit fixture. The final complete validation and delivery scope are recorded in [the Increment 3 report](INCREMENT_3_REVIEW.md).
