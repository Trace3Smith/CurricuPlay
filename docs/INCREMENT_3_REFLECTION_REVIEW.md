# Increment 3 reflection-save investigation

Branch: `classthread-lessons-memory`. **Final live manual verification passed, as confirmed by the user.** The feedback correction required no database migration. The separate lineage correction is documented in [its review report](INCREMENT_3_LINEAGE_REVIEW.md). The user authorized committing and pushing the approved Increment 3 branch after final validation; no merge or production deployment is included.

## Successful live review

In the real application connected to ClassThread Development Supabase, the user saved a 2/5 reflection on the taught Version 1 of **Four Corners Academic Review** and confirmed that it persisted after refresh. The user also confirmed inline reflection success/error feedback, retention of unsaved reflection text on failure, and clearer Planned/Taught labeling. Subsequent revision and reusable-copy testing left the original taught history and reflection unchanged. Both Increment 3 migrations were verified in Development. The issue is closed by that successful manual review; the original failed request's underlying database response was never captured and is not retroactively inferred.

## Confirmed findings

The reflection form submits `POST /api/lessons/<teaching-record-id>/reflection` with a nullable optimistic revision, integer rating and six text fields. The API requires the current authenticated identity, same-origin JSON and strict request validation. The production adapter calls `reflect_on_lesson` with that taught-record ID and the validated fields. SQL derives the workspace from the authenticated identity, locks the taught record, checks reflection revision and inserts or updates that record's reflection. It never changes the scheduled occurrence or lesson version.

**The confirmed feedback defect is at the response-to-UI boundary.** `useLessons.run` catches the failed request and sets `error`, but `Plan` previously displayed all errors and success notices only at the top of the lesson detail page. The reflection form can be several screens below that location. On a rejected save, its fields remained open with no adjacent error. The original 1920×1080 screenshot reproduces that exact lack of visible feedback after an injected HTTP 503. This is a controlled failure reproduction, not evidence that the user's live Supabase returned 503.

A second confirmed case produces the same confusing symptom: the reflection POST succeeds, but the following lesson-library GET fails. The write is committed, yet the form closes without updated reflection data and the refresh error was again above the viewport. The regression distinguishes this case from a rejected database write and checks the actual stored row.

The local runtime inspection found no listener on port 5173 at the time of investigation; only the fixture on 5174 was running. The real development server was started with logs at `/tmp/classthread-reflection-server.log`. Its browser session check returned `configured: true`, `fixture: false`, `authenticated: false`, with no Vite overlay or page errors. This is the agent's clean browser; it does not establish the state of the user's signed-in session at the time of the reported failure.

At investigation time, the specific reason the original live save did not appear to persist was not established: the agent could not access that signed-in browser or its historical Network response. No database/RLS change was justified for the confirmed feedback defect. The successful live retest above is user-reported evidence, separate from the controlled failure tests.

## Fix implemented for the confirmed defects

- Lesson mutation feedback can be scoped to the actual teaching record that submitted it.
- Reflection saving shows **Saving reflection…** and disables the form while pending.
- A rejected request displays its error beside that taught use, scrolls it into view, and preserves the unsaved teacher text.
- A successful save displays its confirmation beside the same taught use. It remains visible after the editor closes.
- If the write succeeds but refresh fails, the message explicitly says **Saved, but refreshed lessons could not be loaded** and offers **Reload saved reflection**.
- Unrelated lesson and Resource errors retain their existing page-level handling.
- Production Supabase failures log only `ClassThread lesson RPC failed` with the RPC name and error code. Teacher text, IDs, cookies, tokens, and provider message/details are excluded.

## Planned / Taught presentation

The database intentionally retains the scheduled occurrence when a teaching record is added. In the occurrence list, one occurrence renders once, with its display status derived from whether a teaching record references it. The test confirmed that marking one scheduled occurrence taught does not insert another occurrence.

Two separately scheduled uses for the same lesson, assignment and date can legitimately appear as one Planned and one Taught card. The UI now labels the uses, shows both scheduled and actual taught dates, and explains that same-date entries are separate uses. A taught heading uses the actual taught date. Teaching Memory links to the corresponding taught use; it is a summary of that use, not an additional occurrence. The scheduling form changes to **Schedule another use** once a version has already been scheduled and explains that it creates a separate planned use.

No occurrence is deleted, merged, relabeled, or automatically marked taught. Final live review confirmed the Planned/Taught distinction and that scheduling the reusable copy once produced exactly one Planned use. The original failed-review cards were not inspected by live record ID.

## Regression evidence

Before changing the implementation, the following three new tests failed on the original code:

1. An injected rejected reflection POST produced a page-top alert but no alert beside the reflection form at 1920×1080.
2. A real successful fixture POST followed by an injected failed library GET produced no local saved/refresh-failed message.
3. Two scheduled occurrences, one marked taught, had the correct database identities and statuses but lacked the explanation and link needed to distinguish their presentation.

After the fix, all eight lesson browser/API tests passed. The rejected-save test was extended to verify pending state, successful retry, visible confirmation, refresh persistence and unchanged lesson/occurrence/taught history. A fourth test checks the actual Supabase SDK request and privacy-safe diagnostics for a rejected authenticated reflection RPC.

## Local verification at the reflection-fix checkpoint

- Full suite: `npx playwright test --workers=2` — **174 passed (3.4m)**, including all original 98 Games regressions. The count increased from 170 by four tests in this follow-up.
- TypeScript: `npm run typecheck` — passed.
- Production build: `npm run build` — passed. Existing warnings remain for React Router module directives, Zod purity annotations, and the legacy Games bundle exceeding the chunk-size advisory threshold.
- Content: `npm run content:validate` — passed (755 curriculum records, 737 dated / 18 undated, 211 drafts; no errors or warnings).
- Four Corners: `python3 scripts/validate-four-corners.py` — passed (264 validated records, no errors, zero unreviewed).
- All browser tests ran at 1920×1080. The reflection failure and successful-retry screenshots were also inspected visually: feedback is within the viewport beside the taught use, the failed draft remains intact, and the successful reflection is displayed.
- `git diff --check` — passed. No Games implementation, original Games tests, Increment 1/2 migrations, or applied Increment 3 migration were changed for this investigation. No Supabase migration step is required for the confirmed feedback fix.

The later successful live manual review is recorded above. The complete final suite, including the subsequent lineage correction, is recorded in [the final Increment 3 report](INCREMENT_3_REVIEW.md).

## Files changed in this follow-up

- `src/modules/lessons/useLessons.ts`: target mutation feedback to the submitting taught record.
- `src/modules/lessons/Plan.tsx`: reserve page-level feedback for unscoped operations.
- `src/modules/lessons/LessonUses.tsx`: inline reflection feedback/loading and clearer scheduled/taught-use presentation.
- `src/modules/lessons/TeachingMemory.tsx`: link a memory entry to its corresponding taught use.
- `server/providers/supabase/lessons.ts`: safe RPC error diagnostics.
- `tests/lessons.spec.ts`: three browser regressions and persisted-history checks.
- `tests/lessons-provider.spec.ts`: rejected authenticated RPC/diagnostics test.
- `docs/INCREMENT_3_REFLECTION_REVIEW.md`: this evidence and retest guide.

Applied migration checksum, unchanged during this follow-up:

```text
5b567199a2e5c6ba14fa8f40cca27a9b13ee70f57b608fd51a04f834cb337a35  202609270002_lessons_memory.sql
```

## Exact live retest

1. Open `http://localhost:5173/plan` and sign in if needed. Refresh once to load the updated interface.
2. Open **Four Corners Academic Review**, retaining its existing saved version and scheduled/taught history. Do not schedule it again merely to record a reflection.
3. Under **Scheduled & taught uses**, find the **Taught** use by its assignment, scheduled date and actual taught date. Choose **Add reflection** (or **Edit reflection** if an earlier save is already present).
4. Select the rating and enter a short unique note under **What worked**. Click **Save reflection** once. Expect **Saving reflection…**, then an inline **Reflection saved to this taught use and its exact lesson version** confirmation.
5. Refresh the page and confirm the rating/note remains under that taught use and in Teaching Memory. Verify the lesson version and assignment are unchanged.
6. If saving is rejected, the error now appears beside the form and the draft remains. Share that error together with the `/reflection` Network status/JSON response; omit cookies, tokens and private note text. A provider failure also produces a safe RPC/code line in the dev-server terminal/log.
7. If the message says **Saved, but refreshed lessons could not be loaded**, choose **Reload saved reflection** instead of submitting again. Check whether the saved note appears after reload.
8. If Planned and Taught entries share a date, compare their use labels. They represent separate scheduled occurrences; marking one taught must leave the other planned. Do not delete or rewrite either history during this check.
