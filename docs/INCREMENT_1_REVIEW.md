# Increment 1 review — 2026-09-27

ClassThread Teacher Foundation passed manual review on `classthread-foundation`. On September 27 the teacher confirmed My Classroom, assignment/work persistence, completion, and recovery of both Games, and authorized committing/pushing this branch after the Four Corners card correction and verification. No merge, production deployment, or remote migration was performed. Increment 2 has not begun.

## Result

The teacher flow supports sign-in, profile editing, school-year creation/selection, Teaching Assignment creation/selection, real persisted My Classroom records, manual Work Item creation/completion/reopening, and Games entry/exit/recovery. Multiple assignments may be active; changing selection preserves original work ownership and context. Future navigation areas are explicit placeholders.

Google sign-in and passwordless email sign-in/recovery use the server-side Supabase Auth adapter. OAuth scopes are identity-only. Application IDs and repository contracts are separate from Supabase; the browser uses the ClassThread API. PostgreSQL RLS, composite ownership/context foreign keys, restrictive column grants, and optimistic revisions protect private records. Details and manual setup: [Increment 1 guide](INCREMENT_1.md).

One migration creates seven application tables: `app_users`, `teacher_profiles`, `workspaces`, `workspace_memberships`, `school_years`, `teaching_assignments`, and `work_items`. It also creates ownership helpers, an idempotent authenticated bootstrap function, revision/date triggers, indexes, grants, and RLS policies. No future domain tables or Supabase Storage buckets were created.

Games remain browser-local. Original localStorage formats/keys, question banks, engines, content/review services, assessment calculations/history, movement timer implementation, and gameplay styles are unchanged. A versioned compatibility fixture, automatic raw-value preservation snapshot, and checksum-bearing downloads were added before the Games bridge. New Games routes retain dedicated presentation; ClassThread navigation does not claim or upload browser records. The closure fix makes Four Corners show Continue and grade/mode only when its existing read-only loader recovers an active game. Play remains for setup, completed, invalid, withdrawn-content, or inaccessible saves. Jeopardy behavior is unchanged.

## Verification

| Check | Result |
| --- | --- |
| Pre-change regression baseline | 98/98 passed |
| Final complete Playwright suite | **129/129 passed**, four workers |
| Original regressions | All 98 retained and passed; no assertions removed |
| New tests | 31: 7 database authorization, 7 teacher browser workflows, 4 Supabase auth transport/cookie, 3 API/domain, 7 routing/export/card recovery, 3 preservation |
| 1920×1080 Games | Original fit/overlap, gameplay, timer and fullscreen checks passed |
| Teacher mobile | 390-pixel width check and screenshot passed |
| TypeScript | `npm run typecheck` passed; includes server/shared/API, fixture infrastructure, and new tests |
| Production build | `npm run build` passed |
| Compiled browser smoke | Direct routes, unconfigured auth boundary, Jeopardy, Four Corners, ClassThread return, refresh, exact assessment history, and 1920×1080 bounds passed; no browser exceptions |
| Browser bundle boundary | No Supabase SDK, server-auth implementation, PGlite, or fixture-session markers in either emitted JavaScript bundle |
| Dependency tree | `npm ls --depth=0` passed |
| Whitespace | `git diff --check` passed |

Original tests were updated for the new route paths. The review test explicitly returns Home after refresh because real routing now restores the review URL. The assessment-history test waits for its recovered report to mount before inspecting the stored history. Existing scoring, content, layout, and recovery assertions remain intact.

The actual SQL migration was tested in local PGlite PostgreSQL under authenticated/anonymous roles. Tests cover foreign workspace reads/writes, ownership forgery, membership escalation, cross-workspace references, date/context constraints, immutable historical assignment association, completion consistency, and revision conflicts. Auth tests exercise the actual Supabase SDK adapter with mocked HTTP, including identity scopes/PKCE, code verification, protected cookies, logout, invalid credentials, untrusted cookie identity, and session refresh.

The production output separates the ClassThread entry (~376 kB JS / 117 kB gzip) from the existing Games/question-bank chunk (~2.153 MB JS / 174 kB gzip). Screenshots are in ignored `test-results/`, including `classthread-my-classroom.png`, `classthread-mobile.png`, `production-jeopardy.png`, and `production-four-corners.png`, and `games-continue-1920.png`. The compiled smoke screenshots are from the initial Increment 1 review; the card/layout checks and full suite were rerun for closure.

## Remaining warnings and configuration

- Build succeeds with the preserved large Games chunk warning, ignored React Router `use client` directives, and Zod comment-annotation warnings. The last two are dependency bundling warnings; TypeScript reports no errors.
- No Supabase credentials are configured. Real Google OAuth, SMTP delivery, hosted PostgREST, and hosted cookie/callback behavior were not exercised. The migration was not applied remotely. Follow the [manual Supabase steps](INCREMENT_1.md#configure-a-development-supabase-project-manually) before real-account testing.
- No Vercel settings were changed. The repo includes the deployment adapter/rewrite configuration, but hosted verification awaits explicit deployment approval. See [future Vercel configuration](INCREMENT_1.md#vercel-configuration-when-a-later-deployment-is-authorized).
- Existing content/approval/coverage limitations remain. This increment does not add classroom questions, expand grades, infer curriculum, or migrate assessments to the cloud.
- Games backups are local/downloadable; there is no automatic sync or restore UI. Teacher account deletion, organization memberships, and institutional/student authorization are outside this increment.

## Local review

Both development servers were started for review. The normal app is on port 5173; teacher sign-in there explicitly reports missing provider configuration until `.env.local` is filled in. Games work immediately.

| Area | URL |
| --- | --- |
| My Classroom | http://localhost:5173/classroom |
| Games | http://localhost:5173/games |
| Jeopardy | http://localhost:5173/games/jeopardy |
| Four Corners | http://localhost:5173/games/four-corners |

To review the complete persisted teacher workflow now, open **http://127.0.0.1:5174/sign-in**, use an `example.test` email and code **123456**. This explicitly labeled fixture uses local PostgreSQL/RLS and has no Google connection or real email. Its data is separate from the port-5173 browser origin. See [fixture details](INCREMENT_1.md#local-review-without-provider-credentials).

## Exact file manifest

21 modified files; 36 added files. No files deleted. Generated `dist/`, test outputs, local fixture records, and installed dependencies are ignored artifacts.

### Modified

- `.gitignore`
- `README.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `src/App.tsx`
- `src/components/QuestionReview.tsx`
- `src/games/four-corners/FourCorners.tsx`
- `src/main.tsx`
- `tests/content.spec.ts`
- `tests/four-corners-team.spec.ts`
- `tests/four-corners-timer.spec.ts`
- `tests/four-corners.spec.ts`
- `tests/game.spec.ts`
- `tests/materials.spec.ts`
- `tests/reconciliation.spec.ts`
- `tests/review.spec.ts`
- `tests/tomorrow.spec.ts`
- `tests/trial.spec.ts`
- `tsconfig.json`

### Added

- `.env.example`
- `api/[...path].ts`
- `docs/INCREMENT_1.md`
- `docs/INCREMENT_1_REVIEW.md`
- `server/app.ts`
- `server/config.ts`
- `server/ports.ts`
- `server/providers/supabase/database.ts`
- `server/providers/supabase/index.ts`
- `server/providers/supabase/mapping.ts`
- `shared/contracts/foundation.ts`
- `src/app/FoundationProvider.tsx`
- `src/app/GamesEntry.tsx`
- `src/app/LegacyGamesRoute.tsx`
- `src/app/Router.tsx`
- `src/app/Shell.tsx`
- `src/app/api.ts`
- `src/app/class-thread.css`
- `src/integrations/legacy-storage/preservation.ts`
- `src/modules/classroom/MyClassroom.tsx`
- `src/modules/profile/Manage.tsx`
- `src/modules/profile/SignIn.tsx`
- `src/modules/work/WorkQueue.tsx`
- `supabase/migrations/202609260001_teacher_foundation.sql`
- `tests/auth-provider.spec.ts`
- `tests/fixtures/database.ts`
- `tests/fixtures/legacy-browser-state.v1.json`
- `tests/fixtures/provider.ts`
- `tests/fixtures/start-server.ts`
- `tests/foundation-api.spec.ts`
- `tests/foundation-database.spec.ts`
- `tests/foundation-routing.spec.ts`
- `tests/foundation.spec.ts`
- `tests/legacy-preservation.spec.ts`
- `vercel.json`
- `vite.config.ts`
