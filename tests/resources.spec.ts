import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FoundationData } from '../shared/contracts/foundation';
import type { ResourceLibrary, ResourceMetadata } from '../shared/contracts/resources';

const origin='http://127.0.0.1:5174'; const headers={Origin:origin};
test.use({baseURL:origin});
const csv=readFileSync('tests/fixtures/resources/review-table.csv');
const metadata: ResourceMetadata={title:'Community pacing',description:'A synthetic test fixture',type:'pacing_guide',origin:'teacher',sourceName:'Test teacher',subject:'Social studies',course:'Community',grades:['mixed'],standards:[],tags:['maps'],schoolYearId:null,assignmentIds:[]};
async function get<T>(request: APIRequestContext,path: string): Promise<T> { const r=await request.get(`${origin}/api${path}`); expect(r.ok(),await r.text()).toBe(true); return r.json(); }
async function post<T>(request: APIRequestContext,path: string,value: unknown): Promise<T> { const r=await request.post(`${origin}/api${path}`,{headers,data:value}); expect(r.ok(),await r.text()).toBe(true); return r.json(); }
async function login(page: Page) {
  await page.goto('/sign-in'); await post(page.request,'/auth/verify',{email:`${randomUUID()}@example.test`,token:'123456'});
  await post(page.request,'/school-years',{name:'2026–27',startsOn:'2026-08-01',endsOn:'2027-07-31'});
  let f=await get<FoundationData>(page.request,'/foundation');
  for (const title of ['Community','Art']) await post(page.request,'/assignments',{schoolYearId:f.schoolYears[0].id,title,jurisdiction:'Any state',district:'Example',school:'',subject:title,course:'',grades:['mixed'],teachingRole:'Teacher',schedule:'',startsOn:'2026-08-01',endsOn:'2027-07-31',isActive:true});
  f=await get<FoundationData>(page.request,'/foundation');
  await page.request.patch(`${origin}/api/context`,{headers,data:{schoolYearId:f.schoolYears[0].id,assignmentId:f.assignments[0].id,revision:f.profile.revision}});
  await page.goto('/resources'); await expect(page.getByRole('heading',{name:'Resources',exact:true})).toBeVisible(); return f;
}
async function create(request: APIRequestContext) { return post<{id:string}>(request,'/resources',{metadata,original:{kind:'file',fileName:'guide.csv',base64:csv.toString('base64')}}); }
async function propose(request: APIRequestContext,id: string,effectiveFrom='2026-08-01',supersedesId:string|null=null) {
  const data=await get<ResourceLibrary>(request,`/resources/${id}`);
  return post<{id:string}>(request,`/resources/${id}/curriculum`,{resourceVersionId:data.versions[0].id,label:`Community ${effectiveFrom}`,effectiveFrom,effectiveTo:'2027-07-31',purposes:['timing','instructional_detail'],mapping:{sheet:'CSV',firstRow:2,lastRow:3,columns:[{field:'topic',column:'B'},{field:'window',column:'C'}]},supersedesId});
}
async function approve(request: APIRequestContext,id:string,cv:string) {
  return post(request,`/resources/${id}/curriculum/${cv}/review`,{revision:1,approve:true,decisions:{'2-B':'accept','2-C':'accept','3-B':'accept','3-C':'accept'},note:'Keep September week 2 literally. Clarify exact dates before planning.',acknowledgeLimitations:true});
}

test('Teacher uploads, maps, reviews, approves and activates real persisted curriculum at 1920×1080',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'Add resource',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Community guide');
  await page.getByLabel('Source / publisher name',{exact:true}).fill('Example district');
  await page.getByLabel('Source file',{exact:true}).setInputFiles('tests/fixtures/resources/review-table.csv');
  await page.getByRole('button',{name:'Save resource',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Community guide',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Prepare curriculum review',exact:true}).click();
  await page.getByRole('combobox',{name:'Column 1',exact:true}).selectOption('B');
  await page.getByRole('button',{name:'Add column',exact:true}).click();
  await page.getByRole('combobox',{name:'Column 2',exact:true}).selectOption('C');
  await page.getByRole('combobox',{name:'Meaning 2',exact:true}).selectOption('window');
  await page.getByLabel('timing',{exact:true}).check();
  await page.getByRole('button',{name:'Extract for review',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Community guide · review 1',exact:true})).toBeVisible();
  await expect(page.getByText('Uncertain: Timing is preserved literally;', {exact:false})).toBeVisible();
  for(const cell of ['B2','C2','B3','C3']) await page.getByRole('combobox',{name:`Decision for ${cell}`,exact:true}).selectOption('accept');
  await page.getByLabel('Review note',{exact:true}).fill('Use literal timing; confirm the precise dates before planning.');
  await page.getByRole('checkbox',{name:'I reviewed the selected source text',exact:false}).check();
  await page.getByRole('button',{name:'Save review progress',exact:true}).click();
  await expect(page.getByText('Review progress saved.',{exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByRole('combobox',{name:'Decision for C3',exact:true})).toHaveValue('accept');
  await page.getByRole('button',{name:'Approve curriculum review',exact:true}).click();
  await expect(page.getByRole('button',{name:'Activate for assignment',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Activate for assignment',exact:true}).click();
  await expect(page.getByRole('button',{name:'Activation recorded',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/resources-curriculum-review-1920.png',fullPage:true});
  await page.getByRole('link',{name:'My Classroom',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Community guide · review 1',exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading',{name:'Community guide · review 1',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/resources-classroom-1920.png',fullPage:true});
});

test('New originals and midyear activation preserve citations, approved reviews and assignment history',async({page})=>{
  const foundation=await login(page); const resource=await create(page.request); const first=await propose(page.request,resource.id); await approve(page.request,resource.id,first.id);
  const binding=await post<{id:string}>(page.request,`/resources/${resource.id}/curriculum/${first.id}/activate`,{assignmentId:foundation.assignments[0].id,expectedBindingId:null});
  const before=await get<ResourceLibrary>(page.request,`/resources/${resource.id}`);
  await post(page.request,`/resources/${resource.id}/versions`,{revision:1,original:{kind:'file',fileName:'revision.csv',base64:Buffer.from(csv.toString().replace('Maps','Local maps')).toString('base64')}});
  const second=await propose(page.request,resource.id,'2027-01-01',first.id); await approve(page.request,resource.id,second.id);
  await post(page.request,`/resources/${resource.id}/curriculum/${second.id}/activate`,{assignmentId:foundation.assignments[0].id,expectedBindingId:binding.id});
  const after=await get<ResourceLibrary>(page.request,`/resources/${resource.id}`);
  expect(after.versions).toHaveLength(2); expect(after.curriculum.find(c=>c.id===first.id)).toEqual(before.curriculum[0]); expect(after.reviews.find(r=>r.curriculumVersionId===first.id)).toEqual(before.reviews[0]);
  expect(after.bindings.find(b=>b.id===binding.id)).toEqual(before.bindings[0]); expect(after.curriculum.find(c=>c.id===second.id)?.supersedesId).toBe(first.id);
  const original=await page.request.get(`${origin}/api/resources/${resource.id}/versions/${before.versions[0].id}/download`); expect(await original.body()).toEqual(csv); expect(original.headers()['content-disposition']).toContain('attachment');
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z')); await page.goto('/classroom');
  await expect(page.getByRole('heading',{name:'Community 2026-08-01',exact:true})).toBeVisible(); await expect(page.getByText('Scheduled next:',{exact:false})).toContainText('2027-01-01');
  await page.getByLabel('Active Teaching Assignment',{exact:true}).selectOption(foundation.assignments[1].id);
  await expect(page.getByRole('heading',{name:'No active curriculum for this assignment',exact:true})).toBeVisible();
  await page.getByLabel('Active Teaching Assignment',{exact:true}).selectOption(foundation.assignments[0].id);
  await page.clock.setFixedTime(new Date('2027-02-01T12:00:00Z')); await page.reload();
  await expect(page.getByRole('heading',{name:'Community 2027-01-01',exact:true})).toBeVisible();
});

test('Resources API rejects cross-user reads, downloads, mutations, forged ownership and cross-origin uploads',async({page,browser})=>{
  const foundation=await login(page); const resource=await create(page.request); const record=await get<ResourceLibrary>(page.request,`/resources/${resource.id}`);
  const other=await browser.newContext(); const bob=await other.newPage(); await login(bob);
  expect((await get<ResourceLibrary>(bob.request,'/resources')).resources).toEqual([]);
  for(const path of [`/resources/${resource.id}`,`/resources/${resource.id}/versions/${record.versions[0].id}/download`]) expect((await bob.request.get(`${origin}/api${path}`)).status()).toBe(404);
  expect((await bob.request.patch(`${origin}/api/resources/${resource.id}`,{headers,data:{revision:1,metadata}})).status()).toBe(404);
  expect((await bob.request.post(`${origin}/api/resources`,{headers,data:{metadata:{...metadata,assignmentIds:[foundation.assignments[0].id]},original:{kind:'link',url:'https://example.com/resource'}}})).status()).toBe(403);
  expect((await page.request.post(`${origin}/api/resources`,{headers,data:{workspaceId:randomUUID(),metadata,original:{kind:'link',url:'https://example.com/resource'}}})).status()).toBe(400);
  expect((await page.request.post(`${origin}/api/resources`,{headers:{Origin:'https://elsewhere.example'},data:{}})).status()).toBe(403);
  await post(page.request,'/auth/sign-out',{}); expect((await page.request.get(`${origin}/api/resources/${resource.id}`)).status()).toBe(401);
  await other.close();
});

test('Malformed and unsupported originals cannot create partial library entries, and bookmarks are never fetched',async({page})=>{
  await login(page);
  for(const original of [{kind:'file',fileName:'x.pdf',base64:'JVBERg=='},{kind:'file',fileName:'x.json',base64:Buffer.from('{broken').toString('base64')},{kind:'file',fileName:'x.csv',base64:'!!!!'},{kind:'link',url:'https://127.0.0.1/secret'}]) {
    expect((await page.request.post(`${origin}/api/resources`,{headers,data:{metadata,original}})).status()).toBe(400);
  }
  expect((await get<ResourceLibrary>(page.request,'/resources')).resources).toEqual([]);
  const bookmark=await post<{id:string}>(page.request,'/resources',{metadata,original:{kind:'link',url:'https://example.com/curriculum'}});
  const data=await get<ResourceLibrary>(page.request,`/resources/${bookmark.id}`);
  expect(data.versions[0].kind).toBe('link'); expect(data.versions[0].storageKey).toBeNull();
  expect((await page.request.get(`${origin}/api/resources/${bookmark.id}/versions/${data.versions[0].id}/preview`)).status()).toBe(400);
  await page.goto('/resources'); await page.getByLabel('Search resources',{exact:true}).fill('maps'); await expect(page.getByRole('heading',{name:'Community pacing',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Stale metadata, draft decisions, unreviewed activation and incomplete approval are rejected',async({page})=>{
  const foundation=await login(page); const resource=await create(page.request); const cv=await propose(page.request,resource.id);
  expect((await page.request.post(`${origin}/api/resources/${resource.id}/curriculum/${cv.id}/activate`,{headers,data:{assignmentId:foundation.assignments[0].id,expectedBindingId:null}})).status()).toBe(400);
  expect((await page.request.post(`${origin}/api/resources/${resource.id}/curriculum/${cv.id}/review`,{headers,data:{revision:1,approve:true,decisions:{},note:'',acknowledgeLimitations:true}})).status()).toBe(400);
  await post(page.request,`/resources/${resource.id}/curriculum/${cv.id}/review`,{revision:1,approve:false,decisions:{'2-B':'accept'},note:'Draft',acknowledgeLimitations:false});
  expect((await page.request.post(`${origin}/api/resources/${resource.id}/curriculum/${cv.id}/review`,{headers,data:{revision:1,approve:false,decisions:{},note:'',acknowledgeLimitations:false}})).status()).toBe(409);
  await page.goto(`/resources/${resource.id}`);
  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Unsaved stale title');
  expect((await page.request.patch(`${origin}/api/resources/${resource.id}`,{headers,data:{revision:1,metadata:{...metadata,title:'Updated title'}}})).status()).toBe(200);
  await page.getByRole('button',{name:'Save resource details',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('changed or was finalized');
  await page.getByRole('button',{name:'Reload resources',exact:true}).click();
  await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Updated title');
  expect((await page.request.patch(`${origin}/api/resources/${resource.id}`,{headers,data:{revision:1,metadata}})).status()).toBe(409);
});

test('The actual DCSS snapshot uploads through the HTTP/Storage boundary and retains its original bytes',async({page})=>{
  await login(page); const workbook=readFileSync('content/sources/pacing-guide-cells.json');
  const resource=await post<{id:string}>(page.request,'/resources',{metadata:{...metadata,title:'DCSS FY27 snapshot',origin:'district',sourceName:'DCSS'},original:{kind:'file',fileName:'pacing-guide-cells.json',base64:workbook.toString('base64')}});
  const data=await get<ResourceLibrary>(page.request,`/resources/${resource.id}`);
  const result=await post<{id:string}>(page.request,`/resources/${resource.id}/curriculum`,{resourceVersionId:data.versions[0].id,label:'KINDER P17 source check',effectiveFrom:'2026-08-01',effectiveTo:'2027-07-31',purposes:['timing','sequence'],mapping:{sheet:'KINDER',firstRow:17,lastRow:17,columns:[{field:'window',column:'C'},{field:'standards',column:'P'}]},supersedesId:null});
  const review=await get<ResourceLibrary>(page.request,`/resources/${resource.id}`);
  expect(review.curriculum.find(c=>c.id===result.id)?.proposal.nodes[0].assertions[1].citation.cell).toBe('P17');
  const downloaded=await page.request.get(`${origin}/api/resources/${resource.id}/versions/${data.versions[0].id}/download`);
  expect(downloaded.ok()).toBe(true); expect(await downloaded.body()).toEqual(workbook);
});
