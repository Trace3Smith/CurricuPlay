import { test, expect, type Page } from '@playwright/test';
import { ACTIVE_KEY } from '../src/games/spelling-bee/storage';
import { currentWord, type BeeState } from '../src/games/spelling-bee/engine';
const saved = (page: Page): Promise<BeeState> => page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),ACTIVE_KEY);
async function fit(page: Page) {
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth<=innerWidth,height:document.documentElement.scrollHeight<=innerHeight}))).toEqual({width:true,height:true});
}
async function start(page: Page, grade: string, mode = 'mixed') {
  await page.goto('/games/spelling-bee');
  await page.getByLabel('Grade',{exact:true}).selectOption(grade);
  await page.getByLabel('Content mode').selectOption(mode);
  await page.getByLabel('Teacher approval').check();
  await fit(page);
  await page.getByRole('button',{name:'Start Game',exact:true}).click();
}
for (const grade of ['K','2','5']) test(`paced grade ${grade}: complete cycle, pictures, hints, scoring, refresh and repeat`, async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await start(page,grade,grade==='K'?'mixed':'current');
  const initial=await saved(page), seen=new Set<string>();
  for(let i=0;i<initial.flow!.order.length;i++) {
    const s=await saved(page), word=currentWord(s);expect(seen.has(word.id)).toBe(false);seen.add(word.id);
    await fit(page);
    if(grade==='K') {
      await expect(page.getByRole('group',{name:'Beginning letter slot'})).toHaveText('_');
      await expect(page.locator('.bee-play')).not.toContainText(new RegExp(`\\b${word.word}\\b`,'i'));
      await expect(page.locator('.bee-challenge img')).toBeVisible();
      await expect.poll(()=>page.locator('.bee-challenge img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
      if(i===0) {await page.getByLabel('Letter choices').selectOption('3');await fit(page);await page.screenshot({path:'test-results/pacing-kindergarten-choices.png'});}
    } else {
      await expect(page.getByRole('group',{name:'Spelling letter slots'})).toBeVisible();
      if(grade==='5'&&i===0) {await page.getByRole('button',{name:'Reveal Another Letter'}).click();const hints=(await saved(page)).extraLetters;await page.reload();expect((await saved(page)).extraLetters).toEqual(hints);}
    }
    if(i===0) {
      await page.evaluate(()=>{(window as unknown as {spoken:string[]}).spoken=[];speechSynthesis.speak=u=>{(window as unknown as {spoken:string[]}).spoken.push(u.text);};});
      await page.getByRole('button',{name:'Say Word',exact:true}).click();
      expect(await page.evaluate(()=>(window as unknown as {spoken:string[]}).spoken)).toEqual([word.word]);
    }
    await page.getByRole('button',{name:'Teacher: Reveal Answer',exact:true}).click();
    await expect(page.getByRole('group',{name:`Answer: ${grade==='K'?word.word[0].toUpperCase():word.word.toUpperCase()}`,exact:true})).toBeVisible();
    await page.getByRole('button',{name:/^Orange:/}).click();
    await page.getByRole('button',{name:/^Blue:/}).click();
    await page.getByRole('button',{name:'Commit Results',exact:true}).click();
    if(i===0) {await page.screenshot({path:`test-results/pacing-grade-${grade}-play.png`});await page.reload();await expect(page.getByRole('button',{name:/^Orange:/})).toContainText('1');}
    if(i<initial.flow!.order.length-1)await page.getByRole('button',{name:'Next Word',exact:true}).click();
  }
  await expect(page.getByRole('heading',{name:'All prompts in this cycle are committed'})).toBeVisible();await fit(page);
  expect((await saved(page)).session.responses.length).toBe(seen.size*6);
  await page.reload();await page.getByRole('button',{name:'Start Repeat / Review Cycle'}).click();
  expect((await saved(page)).flow!.cycle).toBe(2);await fit(page);
  await expect(page.getByRole('button',{name:/^Orange:/})).toContainText(String(seen.size));
  await page.getByRole('button',{name:'End Game',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End Game',exact:true}).click();
  await expect(page.getByTestId('bee-accuracy')).toHaveText(`33.3% (${seen.size*2}/${seen.size*6})`);await fit(page);
  expect(errors).toEqual([]);
});
test('teacher setup gates uncertainty, changes dates, distinguishes source provenance and supports earlier review',async({page})=>{
  await page.goto('/games/spelling-bee');await expect(page.getByLabel('Instructional cutoff')).toHaveValue('2026-10-09');
  await page.getByLabel('Content mode').selectOption('current');await expect(page.getByRole('button',{name:'Start Game',exact:true})).toBeDisabled();
  await expect(page.getByText(/Kindergarten Unit 2 dates conflict/)).toBeVisible();
  await page.getByLabel('Grade',{exact:true}).selectOption('2');await expect(page.getByRole('status').filter({hasText:'approved prompts'})).toContainText('12 approved prompts');
  await page.getByLabel('Instructional cutoff').fill('2026-10-08');await expect(page.getByRole('button',{name:'Start Game',exact:true})).toBeDisabled();
  await page.getByLabel('Instructional cutoff').fill('2026-10-09');await page.getByLabel('Content mode').selectOption('mixed');
  await page.getByRole('checkbox',{name:/Include Prior-Grade Review/}).check();await expect(page.getByRole('status').filter({hasText:'approved prompts'})).toContainText('Prior-Grade Review');
  await page.getByText('Teacher: preview prompts and evidence',{exact:true}).click();await expect(page.locator('.bee-bank-preview a').first()).toHaveAttribute('href',/docs.google.com/);
  await page.getByLabel('Teacher approval').check();await page.getByLabel('Instructional cutoff').fill('2026-10-08');await expect(page.getByLabel('Teacher approval')).not.toBeChecked();
});
test('exhausted bank adds only explicitly approved prompts and keeps scores, cutoff and browser recovery',async({page})=>{
  await start(page,'2','current');
  for(let i=0;i<12;i++){await page.getByRole('button',{name:/^Purple:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();if(i<11)await page.getByRole('button',{name:'Next Word',exact:true}).click();}
  await page.getByRole('button',{name:'Choose More Eligible Content'}).click();
  await expect(page.getByLabel('Instructional cutoff')).toBeDisabled();await expect(page.getByLabel('Instructional cutoff')).toHaveValue('2026-10-09');
  await page.getByLabel('Teacher approval').check();await page.getByRole('button',{name:'Add Reviewed Prompts'}).click();
  expect((await saved(page)).words).toHaveLength(40);expect((await saved(page)).index).toBe(12);
  await expect(page.getByRole('button',{name:/^Purple:/})).toContainText('12');await page.reload();await fit(page);
  expect((await saved(page)).flow!.selection.cutoff).toBe('2026-10-09');
});
test('Kindergarten general/custom lists default to a picture and single letter; explicit spelling remains available',async({page})=>{
  await page.goto('/games/spelling-bee');await page.getByLabel('Content mode').selectOption('general');await page.getByLabel('Word bank').selectOption('custom');
  await page.getByLabel('Words',{exact:true}).fill('cat');await page.getByLabel('Teacher approval').check();await expect(page.getByRole('button',{name:'Start Game',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('matching reviewed picture');
  await page.getByLabel('Words',{exact:true}).fill('cat | A pet that says meow. | beginning sound | cat');await page.getByLabel('Teacher approval').check();
  await page.getByRole('button',{name:'Start Game',exact:true}).click();await expect(page.getByRole('group',{name:'Beginning letter slot'})).toHaveText('_');
  await expect(page.locator('.bee-play')).not.toContainText(/\bcat\b/i);
});
test('final prompt remains hidden after commit and can be explicitly revealed at exhaustion',async({page})=>{
  await page.goto('/games/spelling-bee');await page.getByLabel('Content mode').selectOption('general');await page.getByLabel('Word bank').selectOption('custom');
  await page.getByLabel('Words',{exact:true}).fill('cat | A pet that says meow. | beginning sound | cat');
  await page.getByLabel('Kindergarten activity').selectOption('spelling');await expect(page.getByRole('heading',{name:'Collect letters. Build a word.'})).toBeVisible();
  await page.getByLabel('Kindergarten activity').selectOption('initial');await page.getByLabel('Teacher approval').check();
  await page.getByRole('button',{name:'Start Game',exact:true}).click();await page.getByRole('button',{name:/^Orange:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();
  await expect(page.getByRole('heading',{name:'All prompts in this cycle are committed'})).toBeVisible();
  await expect(page.locator('.bee-summary')).not.toContainText(/\bcat\b/i);expect((await saved(page)).revealed).toBe(false);
  await page.getByRole('button',{name:'Teacher: Reveal Answer'}).click();await expect(page.getByTestId('bee-last-answer')).toHaveText('C — cat');await fit(page);
  await page.reload();await expect(page.getByTestId('bee-last-answer')).toHaveText('C — cat');
  await page.getByRole('button',{name:'Finish Game'}).click();await expect(page.getByText('C · cat · beginning sound · 1/6 teams correct',{exact:true})).toBeVisible();
});
