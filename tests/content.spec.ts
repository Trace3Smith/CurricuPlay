import { test, expect } from '@playwright/test';
// Isolate the long-term draft workflow from the independently tested classroom pack.
test.beforeEach(async ({ page }) => { await page.route("**/src/data/tomorrow-pack.json*", route => route.fulfill({ contentType: "application/javascript", body: "export default []" })); });

import questions from '../src/data/questions.json' with { type: 'json' };
import curriculum from '../src/data/curriculum.json' with { type: 'json' };

test('Generated content is pending approval and cannot silently become classroom content', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  await expect(page.getByText('211 generated questions await teacher review.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
});

test('Every self-contained question renders and reveals at 1920 × 1080 without repeats', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  test.setTimeout(60000);
  // Approval is simulated only in the test browser. Production JSON remains pending.
  let batch: typeof questions = [];
  await page.route('**/src/data/questions.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(batch.map(q => ({ ...q, reviewStatus: 'approved' })))}` }));
  for (const grade of ['K','1','2','3','4','5']) {
   const gradeQuestions = questions.filter(q => q.grade === grade && !q.requiresExternalClassroomMaterial);
   for (let offset = 0; offset < gradeQuestions.length; offset += 18) {
    batch = gradeQuestions.slice(offset, offset + 18);
    await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.getByRole('button', { name: /JEOPARDY/ }).click();
    await page.getByRole('button', { name: grade === 'K' ? 'Kindergarten' : `${grade}${grade==='1'?'st':grade==='2'?'nd':grade==='3'?'rd':'th'} Grade`, exact: true }).click();
    await page.getByRole('button', { name: /EVERYTHING TAUGHT SO FAR/ }).click();
    await expect(page.getByText(`${batch.length} approved questions available`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
    // Legacy partial-board fixture is only for rendering every draft, never a classroom launch.
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('curricuplay.game.v1')!); localStorage.setItem('curricuplay.game.v1', JSON.stringify({ ...s, screen: 'board', selectedGame: 'jeopardy' })); });
    await page.reload();
    const seen=new Set<string>();
    for (let n=0;n<batch.length;n++) {
      const available=page.locator('.tile:not([disabled])');
      await expect(available.first()).toBeEnabled(); await available.first().click();
      const prompt=await page.locator('main h1').innerText();expect(seen.has(prompt)).toBe(false);seen.add(prompt);
      const q=questions.find(q=>q.grade===grade&&q.question===prompt)!;expect(q).toBeTruthy();
      if ('teacherSetup' in q) await expect(page.locator('.teacher-setup')).toContainText(q.teacherSetup!);
      for (const revealed of [false,true]) {
        if(revealed) await page.getByRole('button', { name: 'Reveal Answer' }).click();
        expect(await page.evaluate(() => [...document.querySelectorAll('main h1, main button, .answer, .teacher-setup, .question-meta')].every(el => {
          const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;
        }))).toBe(true);
        expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
        // Detect internal overlap as well as clipped viewport content.
        expect(await page.evaluate(()=>{
          const content=document.querySelector('.question-content')!.getBoundingClientRect();
          const h=document.querySelector('main h1')!.getBoundingClientRect();
          const a=document.querySelector('.answer')?.getBoundingClientRect();
          return h.top>=content.top && (a?a.bottom:h.bottom)<=content.bottom;
        })).toBe(true);
      }
      await expect(page.locator('.answer p')).toHaveText(q.answer);
      if(n===0) await page.screenshot({path:`test-results/real-grade-${grade}-${offset}.png`});
      await page.getByRole('button',{name:'Back to Board'}).click();
    }
    await expect(page.locator('.tile:not([disabled])')).toHaveCount(0);
    expect(seen.size).toBe(batch.length);
   }
  }
  expect(errors).toEqual([]);
});

test('Real curriculum filters exclude future and undated entries; recurring weeks preserve introduction', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.goto('/');
  const result=await page.evaluate(async (qs)=>{
    // @ts-expect-error Vite module
    const {getCurriculum}=await import('/src/services/curriculumService.ts');
    // @ts-expect-error Vite module
    const {createQuestionEngine}=await import('/src/services/questionEngine.ts');
    const engine=createQuestionEngine(qs.map(q=>({...q,reviewStatus:'approved'})));
    const f={grade:'5',subject:'Science',range:'recent',asOf:'2026-09-13'};
    const recent=engine.getQuestions(f);
    return {rows:getCurriculum('K','all','2026-09-13'),recentIds:recent.map((q:{id:string})=>q.id),introduced:recent.map((q:{weekIntroduced:string})=>q.weekIntroduced),before:engine.getQuestions({...f,range:'all',asOf:'2026-08-09'}).length};
  },questions);
  expect(result.rows.length).toBeGreaterThan(0);
  expect(result.rows.every((r:{weekOf:string})=>r.weekOf&&r.weekOf<='2026-09-13')).toBe(true);
  expect(result.recentIds).toHaveLength(3);
  expect(result.introduced).toEqual(Array(3).fill('2026-08-10'));
  expect(result.before).toBe(0);
  expect(curriculum.filter(r=>r.weekOf===null)).toHaveLength(18);
});


test('Refresh cannot restore a question whose approval has been withdrawn', async ({ page }) => {
  const q=questions[0];
  await page.addInitScript((q)=>localStorage.setItem('curricuplay.game.v1',JSON.stringify({version:1,screen:'question',selectedGame:'jeopardy',grade:q.grade,range:'all',asOf:'2026-09-13',usedQuestionIds:[q.id],usedTiles:['Math-0'],current:{questionId:q.id,tileId:'Math-0',category:'Math',revealed:true}})),q);
  await page.goto('/');
  await expect(page.getByText(q.question,{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reveal Answer'})).toHaveCount(0);
});

test('Material-safe real drafts support a Kindergarten full board; other grades report coverage gaps', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.route('**/src/data/questions.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(questions.map(q => ({ ...q, reviewStatus: 'approved' })))}` }));
  for (const grade of ['K', '1', '2', '3', '4', '5']) {
    await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.getByRole('button', { name: /JEOPARDY/ }).click();
    await page.getByRole('button', { name: grade === 'K' ? 'Kindergarten' : `${grade}${grade==='1'?'st':grade==='2'?'nd':grade==='3'?'rd':'th'} Grade`, exact: true }).click();
    await page.getByRole('button', { name: /EVERYTHING TAUGHT SO FAR/ }).click();
    const eligible = questions.filter(q => q.grade === grade && !q.requiresExternalClassroomMaterial).length;
    await expect(page.getByText(`${eligible} approved questions available`)).toBeVisible();
    if (grade !== 'K') { await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled(); continue; }
    await page.getByRole('button', { name: 'Start Game' }).click();
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.locator('.tile:not([disabled])').first().click();
      const id = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!).current.questionId);
      expect(ids.has(id)).toBe(false); ids.add(id);
      await page.getByRole('button', { name: 'Reveal Answer' }).click();
      await page.getByRole('button', { name: 'Back to Board' }).click();
    }
    expect(ids.size).toBe(30);
    await expect(page.locator('.tile.used[disabled]')).toHaveCount(30);
  }
});
