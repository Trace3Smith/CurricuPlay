# ClassThread Increment 1 — Teacher Foundation

Implemented on `classthread-foundation` and manually approved on September 27, 2026. The approved closure includes the Four Corners Continue-card fix and authorization to commit/push this branch after verification. No merge, production deployment, or remote migration is authorized; Increment 2 has not begun.

## What is implemented

- ClassThread shell and real browser routes for My Classroom, Plan, Teach, Games, Assess, Manage, Create, Resources, Evidence, and Calendar. Only My Classroom, Manage, manual Work Queue, authentication, and existing Games have substantive functionality.
- Google identity sign-in and passwordless email codes (the same email path restores access). Auth tokens stay in server-managed HttpOnly cookies; HTTPS environments use Secure cookies. The server verifies identity with the auth provider and refreshes sessions as needed.
- Personal workspace ownership, a stable application user ID distinct from the provider subject, teacher name/timezone, school years, Teaching Assignments, and manual Work Items backed by PostgreSQL.
- Multiple simultaneously active assignments. Selection is a profile preference; selecting another year/assignment cannot rewrite existing work. Assignment context is immutable in this increment. Create a new assignment when the school/course/role changes. Creating inactive historical assignments is supported; assignment editing/archival workflows are deferred.
- Workspace-level personal work or assignment-specific work, due dates, priorities, completion and reopening. My Classroom displays persisted records and honest empty states. There are no default tasks or production demo records.
- Games retain local browser ownership. Sign-in neither uploads nor claims existing local data. Games remain available without authentication or a configured backend.

Plan, Teach, Assess, Create, Resources, Evidence, and Calendar are labeled placeholders. No Resources/Curriculum, Lessons, Evaluation, packs, parent/student features, email/calendar integrations, document generation, classroom management, or automation domain was implemented. Work Items do not represent executable Actions.

## Boundaries

```text
React shell/modules → provider-independent HTTP contracts → server/app.ts
                                                        → AuthPort
                                                        → FoundationRepository
                                                           ↓
                                              server/providers/supabase
                                                           ↓
                                               Supabase Auth / PostgreSQL

/games/* → existing game components/engines → existing localStorage records
           preservation/export adapter runs before game components mount
```

- `shared/contracts/foundation.ts`: input validation, types, and context rules; no provider SDK.
- `server/ports.ts`: identity and repository interfaces; provider subjects remain server-side.
- `server/app.ts`: authenticated use cases, ownership/context checks, same-origin JSON mutations, request-size limits, private/no-store responses, optimistic concurrency, sanitized errors.
- `server/providers/supabase/`: the only production Supabase SDK imports, row mappings, cookie/session handling, and repository implementation. Uses a publishable key plus the signed-in user's session, never a service-role key.
- `api/[...path].ts` and `vite.config.ts`: thin deployment/local adapters for the same handler. Parsed Vercel request bodies and local Node streams are both supported.
- `src/app/`: router, shell, HTTP client, session/record state, and Games bridge. No Supabase SDK in browser code.
- `src/modules/`: profile/setup, My Classroom, manual Work Queue.
- `tests/fixtures/`: explicit local test auth plus PGlite PostgreSQL. Production imports none of it.

Google requests only `openid email profile`. There are no Drive, Gmail, Outlook, or calendar permissions or connector credentials. Adding Microsoft later means adding a provider choice in the auth boundary, not changing domain ownership or the data model.

## Database migration

One migration: `supabase/migrations/202609260001_teacher_foundation.sql`.

Exactly seven application tables:

| Table | Purpose |
| --- | --- |
| `app_users` | Stable application UUID; unique link to `auth.users.id` |
| `teacher_profiles` | Teacher name/timezone and selected context with revision |
| `workspaces` | Teacher-owned personal workspace |
| `workspace_memberships` | Owner membership; no school/admin membership grants |
| `school_years` | Workspace-scoped year and date interval |
| `teaching_assignments` | Workspace/year, jurisdiction/district/school labels, subject/course, grades, role, schedule notes, dates, active state |
| `work_items` | Workspace/creator, optional original assignment, manual source, due date, priority, status, completion timestamp and revision |

Education context is deliberately represented by validated labels here, not a fabricated state/district/school registry. Referencing a school grants it no ownership or access. Future reference catalogs and declarative/versioned packs can be added in later migrations.

All seven tables have row-level security. Anonymous access is revoked. Membership and app identity are established by an authenticated, idempotent bootstrap function with a fixed search path. Users cannot grant themselves memberships or rewrite ownership/context columns. Composite foreign keys prevent references across workspaces or selected school years. Database triggers enforce assignment dates and increment revisions. The schema contains no Games/session, resource, curriculum, lesson, evaluation, Action, or learner tables.

The migration has been applied and exercised locally in PostgreSQL via PGlite under `authenticated` and `anon` roles. It has **not** been applied to Supabase. Hosted Auth/PostgREST and real Google/email delivery still need a configured development project and a live smoke test.

## Configure a development Supabase project manually

1. Use a separate development Supabase project. Run the migration in its SQL editor as the project database owner, or use your normal Supabase migration process. Run it once; do not paste it repeatedly over existing tables. Keep `public` exposed to the Data API; keep `private` unexposed. Do not disable RLS.
2. Enable the Email auth provider and account creation. Keep anonymous sign-ins disabled. Configure the **Confirm signup** and **Magic Link** email templates to display the OTP: `<p>Your ClassThread sign-in code is <strong>{{ .Token }}</strong>.</p>`. This app accepts a code typed into the original sign-in page; it does not consume magic-link fragments. Configure a verified SMTP sender and suitable provider rate limits for real teacher testing. See [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
3. Enable Google in Supabase Auth. Create a Google OAuth web client and use the Supabase callback displayed in its provider setup, normally `https://<project-ref>.supabase.co/auth/v1/callback`, as Google's authorized redirect URI. Supply the Google client ID/secret to Supabase. Select only identity scopes. See [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).
4. Set the development Site URL to `http://localhost:5173`. Add `http://localhost:5173/api/auth/callback` to the Supabase redirect allowlist. The application derives its callback from `CLASSTHREAD_ORIGIN`; it does not trust an arbitrary redirect URL from the browser.
5. Copy `.env.example` to `.env.local`, then fill in:

   ```dotenv
   CLASSTHREAD_ORIGIN=http://localhost:5173
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
   ```

   These are server configuration values. Do not add a `VITE_` prefix or use a service-role key. Do not commit `.env.local`.
6. Use Node **24.x** (the tested runtime), run `npm ci`, then `npm run dev -- --port 5173 --strictPort`. Visit the exact configured origin. `localhost` and `127.0.0.1` have separate browser storage and auth origins.
7. Sign in, create/edit a profile, create/select a school year, create/select an assignment, and create/complete a task. Test both Google and email for the same verified address and confirm they return to the same application identity; account linking remains Supabase's verified-identity behavior. Also test sign-out, another account, refresh, and a second device. Never link accounts by client-supplied email or a manually edited provider subject.

Without these settings, the real app explicitly says sign-in is unconfigured. Games remain accessible. It does not silently use test authentication or an in-browser substitute database.

## Vercel configuration, when a later deployment is authorized

No Vercel project settings or environments were changed. The repo includes the Node API entry and SPA rewrite configuration for later use.

- Runtime: Node 24.x; build: `npm run build`; output: `dist`.
- Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `CLASSTHREAD_ORIGIN` as server environment variables. Use separate development/preview and production Supabase projects.
- `CLASSTHREAD_ORIGIN` must be the exact HTTPS origin for that environment, without a trailing slash or path. Add the matching `/api/auth/callback` in Supabase. Use an explicitly configured preview origin rather than accepting arbitrary Host headers.
- Keep `/api/*` routed to `api/[...path].ts`; `vercel.json` rewrites SPA routes while preserving API and asset paths. A static-only host can run Games but cannot supply Teacher Foundation authentication/data.
- No storage buckets, external integrations, webhooks, email-reading permissions, or calendar scopes are needed.
- After approval, verify the hosted callback, cookie refresh, SMTP delivery, PostgREST grants/RLS, and direct-route refresh against that environment before promoting it. See [Vercel Node request handling](https://vercel.com/docs/functions/runtimes/node-js).

## Local review without provider credentials

```bash
npm run dev:fixture
```

Visit **http://127.0.0.1:5174/sign-in**, enter an `example.test` email (for example `teacher@example.test`), and use code **123456**. A visible development banner identifies this environment; Google is disabled and no email is sent. Each email owns a separate empty workspace. Records are written to local PostgreSQL using the actual migration and RLS policies. They persist in `/tmp/classthread-foundation-fixture`; set `CLASSTHREAD_FIXTURE_DB` to another directory for an independent fixture. Fixture sessions reset on server restart; signing in with the same email recovers its records.

This is an explicit testing tool, not an authentication fallback. It refuses to start with `NODE_ENV=production` or `VERCEL`. Its port is a different storage origin from the existing app, so it cannot see the real browser's Games records on port 5173. Do not enter real student information into it.

| Area | Real app | Explicit local fixture |
| --- | --- | --- |
| My Classroom | http://localhost:5173/classroom | http://127.0.0.1:5174/classroom |
| Games | http://localhost:5173/games | http://127.0.0.1:5174/games |
| Jeopardy | http://localhost:5173/games/jeopardy | http://127.0.0.1:5174/games/jeopardy |
| Four Corners | http://localhost:5173/games/four-corners | http://127.0.0.1:5174/games/four-corners |

Other routes: `/sign-in`, `/manage`, `/manage/work`, `/games/review`, `/plan`, `/teach`, `/assess`, `/create`, `/resources`, `/evidence`, `/calendar`. Original `/#review` and `/#four-corners` bookmarks redirect to their Games routes.

## Games preservation

The five existing keys and their formats remain unchanged:

```text
curricuplay.game.v1
curricuplay.reviews.v1
curricuplay.four-corners.v1
curricuplay.four-corners.timer.v1
curricuplay.sessions.v1
```

A checked-in raw browser fixture predates the route changes. Before existing Games components mount, the bridge captures raw values (including malformed strings) under the separate `classthread.legacy-backup.v1` key. It never replaces an existing snapshot or clears legacy keys. Failed snapshot writes retain an in-memory copy and surface a warning. Exports contain only the five allowlisted values, origin/date, a format version, and SHA-256 checksums; no credentials or unrelated browser storage. Export from Games or Manage; Manage also downloads the original snapshot. No automatic upload, claim, import, database conversion, or deletion exists.

The existing recovery/validation rules still apply: a running movement countdown resets when the game is remounted, an expired timer restores TIME, invalid/withdrawn content cannot silently resume, and corrupt assessment history is left untouched. ClassThread navigation preserves questions, allocations, pending team marks, committed scores, and history. The Four Corners landing card reads the existing recovery loader: recoverable active games show Continue with grade/mode; setup, completed, invalid, withdrawn-content, or inaccessible saves show Play. This label check never writes Four Corners storage. Browser Back to the Games landing does not reset Jeopardy. The existing full-screen controls and dedicated 1920×1080 layouts remain.

The snapshot is a local safeguard, not a cross-device backup. Download it before clearing browser data or changing domains. No restore UI is included in this increment; retain the exported raw values for a reviewed recovery/migration later.

## Verification and limits

See `INCREMENT_1_REVIEW.md` for the final test/build results and exact changed-file manifest.

The suite checks real SQL row isolation and constraints, application ownership/validation, auth-provider transport and cookies, assignment switching, persisted UI workflows, legacy exports, route recovery, and the original gameplay/assessment/layout regressions. Provider transport tests use mocked HTTP responses; the development fixture uses local PostgreSQL and explicit test identities. Neither substitutes for a live configured Supabase/Google/SMTP smoke test.

Existing question/content coverage limitations remain as before. This increment does not generate questions, change approvals, modify curriculum evidence, or expand a game bank. Future resources and private teacher libraries should continue to belong to the teacher's personal workspace; adding an institutional reference must never transfer ownership. Future parent/student authorization requires separate explicit relationships and policies, not broader workspace access.
