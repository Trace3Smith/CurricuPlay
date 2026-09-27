import { test, expect } from '@playwright/test';
import type { FixtureDatabase } from './fixtures/database';
import { fixtureDatabase } from './fixtures/database';
import { randomUUID } from 'node:crypto';

test.describe('Increment 1 PostgreSQL authorization', () => {
  test.describe.configure({ mode: 'serial' });
  let db: FixtureDatabase;
  let alice: string, bob: string;
  let workspace: string, owner: string, year: string, assignment: string, task: string;
  test.beforeAll(async () => { db = await fixtureDatabase(); alice = await db.identity('alice@example.test'); bob = await db.identity('bob@example.test'); });
  test.afterAll(async () => { await db?.db.close(); });

  test('Idempotent bootstrap creates one personal workspace and stable application identity', async () => {
    await db.asUser(alice, async tx => { await tx.exec('select public.bootstrap_teacher(); select public.bootstrap_teacher();'); });
    await db.asUser(bob, async tx => { await tx.exec('select public.bootstrap_teacher()'); });
    const rows = await db.asUser(alice, tx => tx.query<{ id: string; owner_user_id: string }>('select * from public.workspaces'));
    expect(rows.rows).toHaveLength(1); workspace = rows.rows[0].id; owner = rows.rows[0].owner_user_id;
    expect(owner).not.toBe(alice);
    const users = await db.asUser(alice, tx => tx.query('select * from public.app_users'));
    expect(users.rows).toHaveLength(1);
  });

  test('A teacher creates years, simultaneous active assignments and their own work', async () => {
    year = randomUUID(); assignment = randomUUID(); task = randomUUID();
    await db.asUser(alice, async tx => {
      await tx.query('insert into public.school_years(id,workspace_id,name,starts_on,ends_on) values($1,$2,$3,$4,$5)', [year, workspace, '2026–27', '2026-08-01', '2027-07-31']);
      for (const id of [assignment, randomUUID()]) await tx.query("insert into public.teaching_assignments(id,workspace_id,school_year_id,title,jurisdiction,subject,grades,teaching_role,starts_on,ends_on) values($1,$2,$3,'Economics','Georgia','Social studies',array['11','12'],'Teacher','2026-08-01','2027-07-31')", [id, workspace, year]);
      await tx.query("insert into public.work_items(id,workspace_id,created_by,assignment_id,title) values($1,$2,$3,$4,'Prepare opening question')", [task, workspace, owner, assignment]);
      expect((await tx.query('select * from public.teaching_assignments where is_active')).rows).toHaveLength(2);
    });
  });

  test('Row policies hide every private domain from another teacher', async () => {
    await db.asUser(bob, async tx => {
      for (const table of ['school_years','teaching_assignments','work_items']) expect((await tx.query(`select * from public.${table} where workspace_id=$1`, [workspace])).rows).toHaveLength(0);
      expect((await tx.query('select * from public.teacher_profiles where user_id=$1', [owner])).rows).toHaveLength(0);
      expect((await tx.query('select * from public.workspace_memberships where workspace_id=$1', [workspace])).rows).toHaveLength(0);
      expect((await tx.query("update public.work_items set status='completed',completed_at=now() where id=$1 returning id", [task])).rows).toHaveLength(0);
    });
  });

  test('Policies reject forged ownership, membership escalation, and anonymous access', async () => {
    await expect(db.asUser(bob, tx => tx.query("insert into public.school_years(workspace_id,name,starts_on,ends_on) values($1,'Forged','2026-08-01','2027-07-31')", [workspace]))).rejects.toThrow(/row-level security/);
    await expect(db.asUser(bob, tx => tx.query('insert into public.workspace_memberships(workspace_id,user_id) values($1,$2)', [workspace, owner]))).rejects.toThrow(/permission denied/);
    await expect(db.asUser(alice, tx => tx.query('update public.workspaces set owner_user_id=$1 where id=$2', [owner, workspace]))).rejects.toThrow(/permission denied/);
    await expect(db.db.transaction(async tx => { await tx.exec('set local role anon'); return tx.exec('select * from public.work_items'); })).rejects.toThrow(/permission denied/);
    await expect(db.db.transaction(async tx => { await tx.exec('set local role anon'); return tx.exec('select public.bootstrap_teacher()'); })).rejects.toThrow(/permission denied/);
  });

  test('Cross-workspace references and out-of-year dates fail at the database boundary', async () => {
    const bobWorkspace = (await db.asUser(bob, tx => tx.query<{ id: string }>('select id from public.workspaces'))).rows[0].id;
    await expect(db.asUser(bob, tx => tx.query("insert into public.teaching_assignments(workspace_id,school_year_id,title,jurisdiction,subject,grades,teaching_role,starts_on,ends_on) values($1,$2,'Forged','Georgia','Art',array['8'],'Teacher','2026-08-01','2027-07-31')", [bobWorkspace, year]))).rejects.toThrow();
    await expect(db.asUser(alice, tx => tx.query("insert into public.teaching_assignments(workspace_id,school_year_id,title,jurisdiction,subject,grades,teaching_role,starts_on,ends_on) values($1,$2,'Wrong dates','Georgia','Art',array['8'],'Teacher','2025-08-01','2027-07-31')", [workspace, year]))).rejects.toThrow(/within its school year/);
  });

  test('Context switching preserves historical work; immutable ownership and assignment columns cannot be rewritten', async () => {
    await db.asUser(alice, async tx => {
      await tx.query('update public.teacher_profiles set selected_school_year_id=$1,selected_assignment_id=$2 where user_id=$3', [year, assignment, owner]);
      await tx.query('update public.teacher_profiles set selected_assignment_id=null where user_id=$1', [owner]);
      expect((await tx.query<{ assignment_id: string }>('select assignment_id from public.work_items where id=$1', [task])).rows[0].assignment_id).toBe(assignment);
    });
    await expect(db.asUser(alice, tx => tx.query('update public.work_items set assignment_id=null where id=$1', [task]))).rejects.toThrow(/permission denied/);
    await expect(db.asUser(alice, tx => tx.query("update public.teaching_assignments set subject='History' where id=$1", [assignment]))).rejects.toThrow(/permission denied/);
  });

  test('Completion enforces timestamp consistency and optimistic revisions', async () => {
    await expect(db.asUser(alice, tx => tx.query("update public.work_items set status='completed' where id=$1", [task]))).rejects.toThrow(/check constraint/);
    await db.asUser(alice, async tx => {
      const saved = await tx.query<{ revision: number }>("update public.work_items set status='completed',completed_at=now() where id=$1 and revision=1 returning revision", [task]);
      expect(saved.rows[0].revision).toBe(2);
      expect((await tx.query("update public.work_items set status='open',completed_at=null where id=$1 and revision=1 returning id", [task])).rows).toHaveLength(0);
    });
  });
});
