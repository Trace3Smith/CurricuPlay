import { PGlite, types, type Transaction } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Real PostgreSQL semantics in a local test database. Never imported by production code. */
export async function fixtureDatabase(directory?: string) {
  // Match PostgREST's JSON contract: dates stay calendar dates, not JS Date objects.
  const db = new PGlite(directory, { parsers: {
    [types.DATE]: value => value,
    [types.TIMESTAMPTZ]: value => new Date(value).toISOString(),
  } });
  const existing = await db.query<{ present: string | null }>("select to_regclass('public.app_users')::text as present");
  if (!existing.rows[0].present) {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, email text unique not null);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/202609260001_teacher_foundation.sql', import.meta.url), 'utf8'));
  }
  // Emulate only Storage metadata/RLS locally; bytes live in a private fixture-only table.
  const storage = await db.query<{ present: string | null }>("select to_regclass('storage.objects')::text as present");
  if (!storage.rows[0].present) await db.exec(`
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text unique,fixture_bytes bytea);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  const resources = await db.query<{ present: string | null }>("select to_regclass('public.resources')::text as present");
  if (!resources.rows[0].present) await db.exec(await readFile(new URL('../../supabase/migrations/202609270001_resources_curriculum.sql', import.meta.url), 'utf8'));
  async function identity(email: string) {
    const result = await db.query<{ id: string }>('insert into auth.users(id,email) values($1,$2) on conflict(email) do update set email = excluded.email returning id', [randomUUID(), email]);
    return result.rows[0].id;
  }
  async function asUser<T>(subject: string, callback: (tx: Transaction) => Promise<T>) {
    return db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [subject]);
      return callback(tx);
    });
  }
  return { db, identity, asUser };
}
export type FixtureDatabase = Awaited<ReturnType<typeof fixtureDatabase>>;
