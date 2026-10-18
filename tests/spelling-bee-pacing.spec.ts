import { test, expect, type Page } from '@playwright/test';
import { ACTIVE_KEY } from '../src/games/spelling-bee/storage';
import { beginGame, currentWord, type BeeState } from '../src/games/spelling-bee/engine';
import { selectCurriculum } from '../src/curriculum/eligibility';
import { curriculumBank } from '../src/games/spelling-bee/bank';
const legacySelection = { grade: '2' as const, mode: 'previous' as const, cutoff: '2026-10-09', priorGrade: false };
const legacyPrevious = () => beginGame(selectCurriculum(curriculumBank, legacySelection), '2', 'missing', 'legacy-previous', '2026-10-09T12:00:00Z', () => .5, { selection: legacySelection, reviewed: true, untilStop: true, choices: 0 })!;
const saved = (page: Page): Promise<BeeState> => page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),ACTIVE_KEY);
async function fit(page: Page) {
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth<=innerWidth,height:document.documentElement.scrollHeight<=innerHeight}))).toEqual({width:true,height:true});
}
// Pin "today" so pacing expectations do not drift with the real calendar.
const pinned = (page: Page) => page.clock.setSystemTime(new Date('2026-10-09T16:00:00Z'));
async function start(page: Page, grade: string, mode = 'mixed') {
  await pinned(page);
  await page.goto('/games/spelling-bee');
  await page.getByLabel('Grade',{exact:true}).selectOption(grade);
  await page.getByLabel('Content mode').selectOption(mode);
  if(grade==='K') await expect(page.locator('.bee-setup')).not.toContainText(/Start Timer|round duration|time expires|End Round Early/);
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
    await expect(page.getByRole('group',{name:`Answer: ${grade==='K'?word.word[0].toUpperCase():word.word.toUpperCase().replace(/^NONFICTION$/, 'NON-FICTION')}`,exact:true})).toBeVisible();
    await endRound(page); await page.getByRole('button',{name:/^Orange:/}).click();
    await endRound(page); await page.getByRole('button',{name:/^Blue:/}).click();
    await endRound(page); await page.getByRole('button',{name:'Commit Results',exact:true}).click();
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
  await pinned(page);await page.goto('/games/spelling-bee');await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-09');
  await expect(page.getByLabel('Content mode').locator('option')).toHaveText(['Current','Review','Current + Review','Teacher-Created / General Practice']);
  await page.getByLabel('Content mode').selectOption('current');await expect(page.getByRole('button',{name:'Start Game',exact:true})).toBeDisabled();
  await expect(page.getByText(/Kindergarten Unit 2 dates conflict/)).toBeVisible();
  await page.getByLabel('Grade',{exact:true}).selectOption('2');await expect(page.getByRole('status').filter({hasText:'approved prompts'})).toContainText('24 approved prompts');
  await expect(page.getByTestId('bee-pacing-window')).toContainText('Current = taught Sept 10 – Oct 9');
  await page.getByLabel('Content mode').selectOption('review');await expect(page.getByRole('status').filter({hasText:'approved prompts'})).toContainText('16 approved prompts');
  await page.getByLabel('Teaching date').fill('2026-08-06');await expect(page.getByRole('status').filter({hasText:/^0 approved prompts/})).toBeVisible();await expect(page.getByText(/No approved prompts for this selection/)).toBeVisible();
  await page.getByLabel('Teacher approval').check();await expect(page.getByRole('button',{name:'Start Game',exact:true})).toBeDisabled();
  await page.getByLabel('Teaching date').fill('2026-10-09');await page.getByLabel('Content mode').selectOption('mixed');
  await page.getByRole('checkbox',{name:/Include Prior-Grade Review/}).check();await expect(page.getByRole('status').filter({hasText:'approved prompts'})).toContainText('Prior-Grade Review');
  await page.getByText('Teacher: preview prompts and evidence',{exact:true}).click();await expect(page.locator('.bee-bank-preview a').first()).toHaveAttribute('href',/docs.google.com/);
  await page.getByLabel('Teacher approval').check();await page.getByLabel('Teaching date').fill('2026-10-08');await expect(page.getByLabel('Teacher approval')).not.toBeChecked();
});
test('exhausted bank adds only explicitly approved prompts and keeps scores, cutoff and browser recovery',async({page})=>{
  await start(page,'2','review');
  for(let i=0;i<16;i++){await endRound(page); await page.getByRole('button',{name:/^Purple:/}).click();await endRound(page); await page.getByRole('button',{name:'Commit Results',exact:true}).click();if(i<15)await page.getByRole('button',{name:'Next Word',exact:true}).click();}
  await page.getByRole('button',{name:'Choose More Eligible Content'}).click();
  await expect(page.getByLabel('Teaching date')).toBeDisabled();await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-09');
  await page.getByLabel('Teacher approval').check();await page.getByRole('button',{name:'Add Reviewed Prompts'}).click();
  expect((await saved(page)).words).toHaveLength(40);expect((await saved(page)).index).toBe(16);
  await expect(page.getByRole('button',{name:/^Purple:/})).toContainText('16');await page.reload();await fit(page);
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
  await page.getByRole('button',{name:'Start Game',exact:true}).click();await endRound(page); await page.getByRole('button',{name:/^Orange:/}).click();await endRound(page); await page.getByRole('button',{name:'Commit Results',exact:true}).click();
  await expect(page.getByRole('heading',{name:'All prompts in this cycle are committed'})).toBeVisible();
  await expect(page.locator('.bee-summary')).not.toContainText(/\bcat\b/i);expect((await saved(page)).revealed).toBe(false);
  await page.getByRole('button',{name:'Teacher: Reveal Answer'}).click();await expect(page.getByTestId('bee-last-answer')).toHaveText('C — cat');await fit(page);
  await page.reload();await expect(page.getByTestId('bee-last-answer')).toHaveText('C — cat');
  await page.getByRole('button',{name:'Finish Game'}).click();await expect(page.getByText('C · cat · beginning sound · 1/6 teams correct',{exact:true})).toBeVisible();
});

test('date defaults to today in America/New_York and explains the Current window',async({page})=>{
  await page.clock.setSystemTime(new Date('2026-10-18T02:30:00Z'));
  await page.goto('/games/spelling-bee');await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-17');
  await expect(page.getByTestId('bee-pacing-window')).toContainText('Current = taught Sept 18 – Oct 17 (newest first). Review = taught before Sept 18.');
  await page.getByLabel('Teaching date').fill('2026-10-19');await expect(page.getByTestId('bee-pacing-window')).toContainText('Current = taught Sept 20 – Oct 19');
  await page.getByRole('button',{name:'Use today in America/New_York'}).click();await expect(page.getByLabel('Teaching date')).toHaveValue('2026-10-17');
});
test('date defaults to the real current day when the clock is not pinned',async({page})=>{
  await page.goto('/games/spelling-bee');
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()));
  await expect(page.getByLabel('Teaching date')).toHaveValue(today);
});
test('an older saved game using legacy "previous" mode loads and plays without being rewritten',async({page})=>{
  await page.goto('/games/spelling-bee');
  const raw=JSON.stringify(legacyPrevious());
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:ACTIVE_KEY,raw});
  await page.reload();await expect(page.getByRole('group',{name:'Spelling letter slots'})).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toContainText('Word 1 of 28');
  expect(await page.evaluate(key=>localStorage.getItem(key),ACTIVE_KEY)).toBe(raw);
});

async function endRound(page: Page) { const button = page.getByRole('button', { name: 'Teacher: End Round Early', exact: true }); if (await button.count() && await button.isEnabled()) await button.click(); }
