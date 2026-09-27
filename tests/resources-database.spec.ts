import { test, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { fixtureDatabase, type FixtureDatabase } from './fixtures/database';
import { readTabular, tabularAdapter } from '../server/ingestion/tabular';
import type { ResourceMetadata } from '../shared/contracts/resources';

const metadata: ResourceMetadata = { title:'A private guide',description:'',type:'pacing_guide',origin:'district',sourceName:'Example district',subject:'Music',course:'',grades:['mixed ages'],standards:[],tags:[],schoolYearId:null,assignmentIds:[] };
const bytes = Buffer.from('Topic,Window\nRhythm,2026-09-01\n');
const mapping = { sheet:'CSV',firstRow:2,lastRow:2,columns:[{field:'topic' as const,column:'A'},{field:'window' as const,column:'B'}] };
const proposal = tabularAdapter.extract(readTabular(bytes,'guide.csv'),mapping);

test.describe('Resources PostgreSQL invariants and RLS', () => {
  test.describe.configure({ mode:'serial' });
  let database: FixtureDatabase, alice: string, bob: string, workspace: string, assignment: string;
  async function rpc<T>(user: string, name: string, p: unknown): Promise<T> {
    return (await database.asUser(user, tx => tx.query<{ value:T }>(`select public.${name}($1) as value`,[JSON.stringify(p)]))).rows[0].value;
  }
  async function makeResource() {
    const id=randomUUID(); const key=`${workspace}/${id}/original`;
    await database.asUser(alice,tx => tx.query('insert into storage.objects(bucket_id,name,fixture_bytes) values($1,$2,$3)',['classthread-resources',key,bytes]));
    const resource=await rpc<string>(alice,'save_resource',{ metadata,version:{id,kind:'file',fileName:'guide.csv',mediaType:'text/csv',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),storageKey:key,externalUrl:null} });
    return { resource,version:id,key };
  }
  async function propose(version: string, from='2026-08-01', supersedesId: string|null=null) {
    return rpc<string>(alice,'propose_curriculum',{resourceVersionId:version,label:'Reviewed music',effectiveFrom:from,effectiveTo:'2027-07-31',purposes:['timing','instructional_detail'],mapping,supersedesId,proposal});
  }
  async function approve(id: string) { await rpc(alice,'review_curriculum',{id,revision:1,approve:true,decisions:{'2-A':'accept','2-B':'accept'},note:'',acknowledgeLimitations:true}); }
  test.beforeAll(async () => {
    database=await fixtureDatabase(); alice=await database.identity('resources-alice@example.test'); bob=await database.identity('resources-bob@example.test');
    for (const user of [alice,bob]) await database.asUser(user,tx => tx.exec('select public.bootstrap_teacher()'));
    workspace=(await database.asUser(alice,tx => tx.query<{id:string}>('select id from public.workspaces'))).rows[0].id;
    const year=randomUUID(); assignment=randomUUID();
    await database.asUser(alice,async tx => {
      await tx.query("insert into public.school_years(id,workspace_id,name,starts_on,ends_on) values($1,$2,'2026–27','2026-08-01','2027-07-31')",[year,workspace]);
      await tx.query("insert into public.teaching_assignments(id,workspace_id,school_year_id,title,jurisdiction,subject,grades,teaching_role,starts_on,ends_on) values($1,$2,$3,'Music','Any state','Music',array['mixed'],'Teacher','2026-08-01','2027-07-31')",[assignment,workspace,year]);
    });
  });
  test.afterAll(async () => { await database?.db.close(); });

  test('Private library and Storage originals are isolated from another workspace and anonymous users',async () => {
    const record=await makeResource(); const cv=await propose(record.version); await approve(cv);
    await rpc(alice,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:null});
    await database.asUser(bob,async tx => {
      for (const table of ['resources','resource_versions','resource_assignments','curriculum_sources','curriculum_source_versions','curriculum_versions','curriculum_reviews','assignment_curriculum_bindings']) expect((await tx.query(`select * from public.${table} where workspace_id=$1`,[workspace])).rows).toEqual([]);
      expect((await tx.query('select * from storage.objects where name=$1',[record.key])).rows).toEqual([]);
      const library=(await tx.query<{value:Record<string,unknown[]>}>('select public.resource_library($1) as value',[record.resource])).rows[0].value;
      expect(Object.values(library).every(rows=>rows.length===0)).toBe(true);
    });
    expect((await database.asUser(alice,tx => tx.query('select * from storage.objects where name=$1',[record.key]))).rows).toHaveLength(1);
    await expect(database.db.transaction(async tx => { await tx.exec('set local role anon'); await tx.exec('select * from public.resource_versions'); })).rejects.toThrow();
    await expect(database.db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select public.save_resource($1)',[JSON.stringify({metadata})]); })).rejects.toThrow();
  });

  test('Resource originals and curriculum provenance cannot be updated or deleted',async () => {
    const record=await makeResource(); const cv=await propose(record.version);
    await expect(database.asUser(alice,tx=>tx.query("update public.resource_versions set sha256=$1 where id=$2",['0'.repeat(64),record.version]))).rejects.toThrow();
    await expect(database.asUser(alice,tx=>tx.query('delete from public.curriculum_versions where id=$1',[cv]))).rejects.toThrow();
    await expect(database.db.query('delete from public.resource_versions where id=$1',[record.version])).rejects.toThrow('immutable');
    await database.asUser(alice,async tx => {
      expect((await tx.query('update storage.objects set fixture_bytes=$1 where name=$2 returning id',[Buffer.from('overwritten'),record.key])).rows).toEqual([]);
      expect((await tx.query('delete from storage.objects where name=$1 returning id',[record.key])).rows).toEqual([]);
    });
    const stored=(await database.asUser(alice,tx=>tx.query<{proposal:unknown}>('select proposal from public.curriculum_versions where id=$1',[cv]))).rows[0].proposal;
    expect(stored).toEqual(proposal);
  });

  test('Editable metadata uses optimistic revision and changing school context does not transfer ownership',async () => {
    const record=await makeResource();
    await rpc(alice,'save_resource',{id:record.resource,revision:1,metadata:{...metadata,sourceName:'A different school',assignmentIds:[assignment]}});
    await expect(rpc(alice,'save_resource',{id:record.resource,revision:1,metadata})).rejects.toMatchObject({code:'40001'});
    const stored=(await database.asUser(alice,tx=>tx.query<{workspace_id:string;revision:number}>('select * from public.resources where id=$1',[record.resource]))).rows[0];
    expect(stored.workspace_id).toBe(workspace); expect(stored.revision).toBe(2);
    const original=(await database.asUser(alice,tx=>tx.query<{metadata:ResourceMetadata}>('select metadata from public.resource_versions where id=$1',[record.version]))).rows[0];
    expect(original.metadata.sourceName).toBe('Example district');
    await expect(rpc(bob,'save_resource',{id:record.resource,revision:2,metadata})).rejects.toMatchObject({code:'42501'});
    await expect(rpc(bob,'save_resource',{metadata:{...metadata,assignmentIds:[assignment]}})).rejects.toMatchObject({code:'42501'});
  });

  test('Source versions preserve authority by purpose and reject forged relationships and provenance',async () => {
    const record=await makeResource(); const cv=await propose(record.version);
    const source=(await database.asUser(alice,tx=>tx.query<{resource_version_id:string;purposes:string[]}>('select * from public.curriculum_source_versions where resource_version_id=$1',[record.version]))).rows[0];
    expect(source.resource_version_id).toBe(record.version); expect(source.purposes).toEqual(['timing','instructional_detail']);
    const other=await makeResource();
    await expect(propose(other.version,'2027-01-01',cv)).rejects.toMatchObject({code:'23514'});
    await expect(rpc(bob,'propose_curriculum',{resourceVersionId:record.version,proposal})).rejects.toMatchObject({code:'42501'});
    const forged=structuredClone(proposal); forged.nodes[0].assertions[0].citation.quote='Different source text';
    await expect(rpc(alice,'propose_curriculum',{resourceVersionId:record.version,proposal:forged})).rejects.toMatchObject({code:'23514'});
  });

  test('Approval requires complete review, acknowledgement and conflict notes; approved decisions freeze',async () => {
    const record=await makeResource(); const cv=await propose(record.version);
    const input={id:cv,revision:1,approve:true,decisions:{'2-A':'accept'},note:'',acknowledgeLimitations:true};
    await expect(rpc(alice,'review_curriculum',input)).rejects.toMatchObject({code:'23514'});
    await expect(rpc(alice,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:null})).rejects.toMatchObject({code:'23514'});
    await expect(rpc(alice,'review_curriculum',{...input,decisions:{'2-A':'accept','2-B':'exclude'},acknowledgeLimitations:false})).rejects.toMatchObject({code:'23514'});
    await approve(cv);
    await expect(rpc(alice,'review_curriculum',{...input,revision:2,approve:false})).rejects.toMatchObject({code:'40001'});
    await expect(database.db.query("update public.curriculum_reviews set note='rewrite' where curriculum_version_id=$1",[cv])).rejects.toThrow('immutable');
    const uncertain=structuredClone(proposal); uncertain.nodes[0].assertions[1].uncertainty=['Ambiguous timing'];
    const c2=await rpc<string>(alice,'propose_curriculum',{resourceVersionId:record.version,label:'Uncertain',effectiveFrom:'2027-01-01',effectiveTo:'2027-07-31',purposes:['timing'],mapping,supersedesId:cv,proposal:uncertain});
    await expect(approve(c2)).rejects.toMatchObject({code:'23514'});
    await rpc(alice,'review_curriculum',{...input,id:c2,decisions:{'2-A':'accept','2-B':'accept'},note:'Retain the literal timing; clarify before planning.'});
  });

  test('Activation uses exact approved versions, preserves the old binding and rejects stale or backdated changes',async () => {
    const record=await makeResource(); const first=(await database.asUser(alice,tx=>tx.query<{id:string;curriculum_version_id:string}>('select * from public.assignment_curriculum_bindings where assignment_id=$1',[assignment]))).rows[0];
    const cv=await propose(record.version,'2027-01-01'); await approve(cv);
    await expect(rpc(alice,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:null})).rejects.toMatchObject({code:'40001'});
    const next=await rpc<string>(alice,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:first.id});
    const rows=(await database.asUser(alice,tx=>tx.query<{id:string;curriculum_version_id:string;previous_binding_id:string}>('select * from public.assignment_curriculum_bindings where assignment_id=$1 order by effective_from',[assignment]))).rows;
    expect(rows).toHaveLength(2); expect(rows[0].curriculum_version_id).toBe(first.curriculum_version_id); expect(rows[1].curriculum_version_id).toBe(cv); expect(rows[1].previous_binding_id).toBe(first.id);
    await expect(rpc(alice,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:next})).rejects.toMatchObject({code:'23514'});
    await expect(rpc(bob,'activate_curriculum',{id:cv,assignmentId:assignment,expectedBindingId:next})).rejects.toMatchObject({code:'42501'});
  });

  test('Storage rejects uploads into another workspace and preserves originals on duplicate upload',async () => {
    const record=await makeResource();
    await expect(database.asUser(bob,tx=>tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classthread-resources',`${workspace}/${randomUUID()}/original`]))).rejects.toMatchObject({code:'42501'});
    await expect(database.asUser(alice,tx=>tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['classthread-resources',record.key]))).rejects.toMatchObject({code:'23505'});
    const bucket=(await database.db.query<{public:boolean;file_size_limit:number}>('select * from storage.buckets')).rows[0]; expect(bucket.public).toBe(false); expect(Number(bucket.file_size_limit)).toBe(2097152);
  });
});
