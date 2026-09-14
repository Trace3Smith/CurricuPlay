import { test, expect, type Page } from '@playwright/test';
import pack from '../src/data/tomorrow-pack.json' with { type: 'json' };
import report from '../content/reports/TOMORROW_PACK_VALIDATION.json' with { type: 'json' };
const labels: Record<string,string> = {K:'Kindergarten','1':'1st Grade','2':'2nd Grade','3':'3rd Grade','4':'4th Grade','5':'5th Grade'};
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('main h1, main button, .answer')].every(e => { const r=e.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth; }))).toBe(true);
}
for (const row of report.grades) test(`Tomorrow pack ${row.grade}: actual release coverage and classroom flow`,async({page})=>{
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror', e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.setFixedTime(new Date('2026-09-14T12:00:00'));
  await page.goto('/');await page.getByRole('button',{name:/JEOPARDY/}).click();
  await page.getByRole('button',{name:labels[row.grade],exact:true}).click();
  await expect(page.getByText(/DCSS Tomorrow Classroom Pack - 2026-09-14/)).toBeVisible();
  await expect(page.getByText(`${row.classroomAccepted} approved questions available`)).toBeVisible();
  // Full release tests use the actual pack. No synthetic academic content is injected.
  if(row.status==='BLOCKED') {
    await expect(page.getByRole('button',{name:/^Start Game/})).toBeDisabled();
    await expect(page.getByText(`${row.tilesCovered}/30 tiles supported.`,{exact:false})).toBeVisible();
    await page.screenshot({path:`test-results/tomorrow-${row.grade}-blocked.png`});
    expect(errors).toEqual([]);return;
  }
  await page.getByRole('button',{name:/^Start Game/}).click();
  const ids=new Set<string>();const texts=new Set<string>();
  for(let i=0;i<30;i++) {
    await expect(page.locator('.tile:not([disabled])')).toHaveCount(30-i);await fits(page);
    await page.locator('.tile:not([disabled])').last().click();
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('curricuplay.game.v1')!));
    const q=pack.find(q=>q.id===state.current.questionId)!;
    expect(q.grade).toBe(row.grade);expect(q.requiresExternalClassroomMaterial).toBe(false);expect(q.reviewStatus).toBe('approved');
    expect(q.weekIntroduced<='2026-09-13' && q.alignedWeeks.every(w=>w<='2026-09-13')).toBe(true);
    expect(ids.has(q.id)).toBe(false);ids.add(q.id);expect(texts.has(q.question)).toBe(false);texts.add(q.question);
    await expect(page.locator('.answer')).toHaveCount(0);
    if(i===0){await page.reload();await expect(page.getByRole('heading',{name:q.question,exact:true})).toBeVisible();}
    await page.getByRole('button',{name:'Reveal Answer'}).click();await expect(page.locator('.answer p')).toHaveText(q.answer);await fits(page);
    if(i===0){await page.screenshot({path:`test-results/tomorrow-${row.grade}-question.png`});await page.reload();await expect(page.locator('.answer p')).toHaveText(q.answer);}
    await page.getByRole('button',{name:'Back to Board'}).click();await expect(page.locator('.tile.used[disabled]')).toHaveCount(i+1);
  }
  expect(ids.size).toBe(30);await page.screenshot({path:`test-results/tomorrow-${row.grade}-used-board.png`});
  await page.getByRole('button',{name:'Reset Game',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Reset Game',exact:true}).click();
  await expect(page.locator('.tile:not([disabled])')).toHaveCount(30);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('curricuplay.game.v1')!).usedQuestionIds)).toEqual([]);
  await page.getByRole('button',{name:'Change Grade',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Change Grade',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Start Game/})).toBeVisible();
  await page.getByRole('button',{name:labels[row.grade==='K'?'2':'K'],exact:true}).click();await page.getByRole('button',{name:/^Start Game/}).click();
  await expect(page.locator('.tile:not([disabled])')).toHaveCount(30);await fits(page);
  await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.getByRole('button',{name:/JEOPARDY/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Release keeps source cutoffs, teacher vetoes and the draft pipeline separate',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-14T12:00:00'));await page.goto('/');
 const result=await page.evaluate(async()=>{
  // @ts-expect-error Vite module
  const {classroomQuestions}=await import('/src/services/classroomPack.ts');
  // @ts-expect-error Vite module
  const {createQuestionEngine,bank}=await import('/src/services/questionEngine.ts');
  const qs=classroomQuestions({});const q=qs[0];
  const rejected=classroomQuestions({[q.originId]:{status:'rejected',original:'{}',question:'',answer:'',reviewedAt:''}});
  const f={grade:q.grade,range:'all',asOf:'2026-09-14'};
  const bad=[{...q,id:'future',weekIntroduced:'2026-09-15',alignedWeeks:['2026-09-15']},{...q,id:'external',requiresExternalClassroomMaterial:true},{...q,id:'pending',reviewStatus:'pending'},{...q,id:'rejected',reviewStatus:'rejected'}];
  return {drafts:bank.questions.length,pending:bank.questions.every((q:{reviewStatus:string})=>q.reviewStatus==='pending'),veto:!createQuestionEngine(rejected).getQuestions(f).some((x:{id:string})=>x.id===q.id),badCount:createQuestionEngine(bad).getAvailableQuestionCount(f)};
 });expect(result).toEqual({drafts:211,pending:true,veto:true,badCount:0});
});

for(const grade of ['1','3']) test(`Tomorrow pack ${grade}: every retained question fits and reveals while complete launch remains blocked`,async({page})=>{
 test.setTimeout(60000);await page.clock.setFixedTime(new Date('2026-09-14T12:00:00'));await page.goto('/');
 const qs=pack.filter(q=>q.grade===grade);
 // Test-only single-question resume fixtures verify layout; this is NOT a full-game pass.
 for(const q of qs){
  await page.evaluate(q=>{const tileId=`${q.subject}-${q.difficulty-1}`;localStorage.setItem('curricuplay.game.v1',JSON.stringify({version:1,screen:'question',selectedGame:'jeopardy',grade:q.grade,range:'all',asOf:'2026-09-13',contentSource:'classroom',usedQuestionIds:[q.id],usedTiles:[tileId],current:{questionId:q.id,tileId,category:q.subject,revealed:false}}));},q);
  await page.reload();await expect(page.getByRole('heading',{name:q.question,exact:true})).toBeVisible();await fits(page);
  await page.getByRole('button',{name:'Reveal Answer'}).click();await expect(page.locator('.answer p')).toHaveText(q.answer);await fits(page);
 }
});
