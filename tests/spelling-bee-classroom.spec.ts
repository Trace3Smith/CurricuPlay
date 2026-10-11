import { test, expect, type Page } from '@playwright/test';
import { beginGame, type BeeState } from '../src/games/spelling-bee/engine';
import { curriculumBank } from '../src/games/spelling-bee/bank';
import { ACTIVE_KEY } from '../src/games/spelling-bee/storage';
import type { Grade } from '../src/types';
const saved = (page: Page): Promise<BeeState> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), ACTIVE_KEY);
async function load(page: Page, grade: Grade, word: string) {
 await page.goto('/games/spelling-bee');
 const words=curriculumBank.filter(w=>w.grade===grade && [word,grade==='K'?'apple':grade==='2'?'cake':'evidence'].includes(w.word));
 const first=words.find(w=>w.word===word)!; const rest=words.filter(w=>w!==first);
 const s=beginGame([first,...rest],grade,'challenge','classroom-browser','2026-10-09T12:00:00Z',()=>.99,{selection:{grade,cutoff:'2026-10-09',mode:'mixed',priorGrade:false},reviewed:true,untilStop:true,choices:0})!;
 expect(s).toBeTruthy(); await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key:ACTIVE_KEY,s});await page.reload();
}
async function fit(page: Page) {
 expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth<=innerWidth,y:document.documentElement.scrollHeight<=innerHeight}))).toEqual({x:true,y:true});
 expect(await page.locator('.bee-play button, .bee-play select, .bee-challenge img, .bee-slots, .bee-clock').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>innerHeight||r.left<0||r.right>innerWidth||n.scrollWidth>n.clientWidth+2;}).map(n=>n.textContent))).toEqual([]);
 expect(await page.locator('.bee-play button,.bee-play select').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;}))).toBe(true);
}
for (const [grade,word] of [['K','igloo'],['2','shrimp'],['5','nonfiction']] as const) {
 test(`${grade}: classroom walkthrough, grade-appropriate timing, refresh, scoring and next round`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-10T12:00:00Z')});await load(page,grade,word);
  if(grade==='K'){
   await expect(page.getByRole('timer')).toHaveCount(0);await expect(page.getByLabel('Round duration')).toHaveCount(0);
   await expect(page.locator('.bee-play')).not.toContainText(/timer|time expires|early|igloo/i);
   await expect(page.getByRole('group',{name:'Beginning letter slot'})).toHaveText('_');
   await expect(page.locator('.bee-challenge img')).toHaveAttribute('src','/spelling-bee/photos/igloo.webp');
   await expect.poll(()=>page.locator('.bee-challenge img').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>=1000)).toBe(true);
   expect((await page.locator('.bee-challenge img').boundingBox())!.width).toBeGreaterThanOrEqual(400);
   await fit(page);await page.screenshot({path:'test-results/classroom-K.png'});
   await page.getByRole('button',{name:/^Orange:/}).click();
   // A previously saved running Kindergarten timer must not block marking or erase draft marks.
   await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)!);s.timer={duration:300,status:'running',remainingMs:300000,deadline:Date.now()+300000};localStorage.setItem(key,JSON.stringify(s));},ACTIVE_KEY);
   await page.reload();await expect(page.getByRole('timer')).toHaveCount(0);
   await expect(page.getByRole('button',{name:/^Orange:/})).toHaveAttribute('aria-pressed','true');
   await page.getByRole('button',{name:/^Blue:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();
   expect((await saved(page)).session.responses.map(r=>r.pointsAwarded)).toEqual([1,0,0,0,0,1]);
   await page.getByRole('button',{name:'Teacher: Reveal Answer',exact:true}).click();await expect(page.getByRole('group',{name:'Answer: I'})).toHaveText('I');
   await page.getByRole('button',{name:'Next Word',exact:true}).click();await expect(page.getByRole('button',{name:'Commit Results',exact:true})).toBeEnabled();await expect(page.getByRole('timer')).toHaveCount(0);
   await page.getByRole('button',{name:'End Game',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End Game',exact:true}).click();
   await expect(page.getByTestId('bee-accuracy')).toHaveText('33.3% (2/6)');expect(errors).toEqual([]);return;
  }
  await expect(page.getByRole('timer')).toHaveText('5:00');await expect(page.getByRole('button',{name:'Commit Results',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:/^Orange:/})).toBeDisabled();
  if(grade!=='5'){
   await expect(page.locator('.bee-challenge img')).toHaveAttribute('src',`/spelling-bee/photos/${word}.webp`);
   await expect.poll(()=>page.locator('.bee-challenge img').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
  }else{
   await expect(page.getByRole('group',{name:'Spelling letter slots'})).toHaveText('___-_______');await expect(page.getByLabel('Hyphen: no letter to collect')).toHaveText('-');
  }
  await page.getByLabel('Round duration').selectOption('30');await page.getByRole('button',{name:'Start Timer',exact:true}).click();
  await page.clock.fastForward(10000);await expect(page.getByRole('timer')).toHaveText('0:20');
  await page.getByRole('button',{name:'Pause Timer',exact:true}).click();await page.clock.fastForward(60000);await expect(page.getByRole('timer')).toHaveText('0:20');
  await page.reload();await expect(page.getByRole('timer')).toHaveText('0:20');await expect(page.getByRole('button',{name:'Commit Results',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Resume Timer',exact:true}).click();await page.clock.fastForward(5000);await page.reload();await expect(page.getByRole('timer')).toHaveText('0:15');
  await page.clock.fastForward(15000);await expect(page.getByText('TIME’S UP — STOP WORKING',{exact:true})).toBeVisible();
  expect((await saved(page)).session.responses).toHaveLength(0);await page.getByRole('button',{name:/^Orange:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Orange:/})).toContainText('1');await expect(page.getByRole('button',{name:'Commit Results',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Teacher: Reveal Answer',exact:true}).click();await expect(page.getByRole('group',{name:grade==='5'?'Answer: NON-FICTION':'Answer: SHRIMP'})).toBeVisible();
  await fit(page);await page.screenshot({path:`test-results/classroom-${grade}.png`});
  await page.getByRole('button',{name:'Next Word',exact:true}).click();await expect(page.getByRole('timer')).toHaveText('0:30');await page.clock.fastForward(60000);await expect(page.getByRole('timer')).toHaveText('0:30');
  await page.getByLabel('Round duration').selectOption('90');await page.getByRole('button',{name:'Teacher: End Round Early',exact:true}).click();await page.getByRole('button',{name:/^Blue:/}).click();
  await page.getByRole('button',{name:'Reset Timer',exact:true}).click();expect((await saved(page)).correctTeamIds).toEqual([]);await expect(page.getByRole('timer')).toHaveText('1:30');
  await page.getByRole('button',{name:'End Game',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End Game',exact:true}).click();
  await expect(page.getByTestId('bee-accuracy')).toHaveText('16.7% (1/6)');expect(errors).toEqual([]);
 });
 for(const [width,height] of [[1536,864],[1280,720]])test(`${grade}: Smart Board at ${width}x${height} scaled CSS viewport`,async({page})=>{
  await page.setViewportSize({width,height});await load(page,grade,word);
  if(grade==='K')await page.getByLabel('Letter choices').selectOption('3');
  await fit(page);if(grade!=='K')await page.getByRole('button',{name:'Teacher: End Round Early',exact:true}).click();await page.getByRole('button',{name:'Teacher: Reveal Answer',exact:true}).click();await fit(page);
  await page.screenshot({path:`test-results/classroom-${grade}-${width}.png`});
 });
}
test('timer sounds exactly once on expiry, never auto-reveals, and does not save every tick',async({page})=>{
 await page.clock.install({time:new Date('2026-10-10T12:00:00Z')});await load(page,'2','shrimp');
 await page.evaluate(()=>{
  const w=window as unknown as {tones:number,writes:number};w.tones=0;w.writes=0;
  const osc=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const o=osc.call(this),start=o.start.bind(o);o.start=(when)=>{w.tones++;start(when);};return o;};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){w.writes++;set.call(this,k,v);};
 });
 await page.getByLabel('Round duration').selectOption('30');await page.getByRole('button',{name:'Start Timer',exact:true}).click();
 await expect(page.getByText(/Sound ready/)).toBeVisible();const writes=await page.evaluate(()=>(window as unknown as {writes:number}).writes);
 await page.clock.fastForward(29000);expect(await page.evaluate(()=>(window as unknown as {writes:number}).writes)).toBe(writes);
 await page.clock.fastForward(1000);await expect(page.getByText('TIME’S UP — STOP WORKING',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as unknown as {tones:number}).tones)).toBe(2);await page.clock.fastForward(5000);expect(await page.evaluate(()=>(window as unknown as {tones:number}).tones)).toBe(2);
 expect((await saved(page)).revealed).toBe(false);expect((await saved(page)).session.responses).toEqual([]);
});
test('browser absence does not pause a running deadline and mobile controls stay reachable',async({page})=>{
 await page.clock.install({time:new Date('2026-10-10T12:00:00Z')});await load(page,'2','shrimp');await page.getByLabel('Round duration').selectOption('30');await page.getByRole('button',{name:'Start Timer',exact:true}).click();
 await page.getByRole('button',{name:'Games',exact:true}).click();await page.clock.fastForward(60000);await page.getByRole('button',{name:/SPELLING BEE/}).click();
 await expect(page.getByText('TIME’S UP — STOP WORKING',{exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:/^Green:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();await page.getByRole('button',{name:'Next Word',exact:true}).click();await expect(page.getByRole('timer')).toHaveText('0:30');
});
test('the summary is persisted before its first painted frame and survives immediate refresh',async({page})=>{
 await load(page,'5','nonfiction');
 await page.getByRole('button',{name:'Teacher: End Round Early',exact:true}).click();
 await page.getByRole('button',{name:/^Orange:/}).click();await page.getByRole('button',{name:'Commit Results',exact:true}).click();
 await page.getByRole('button',{name:'End Game',exact:true}).click();
 await page.evaluate(key=>{
  (window as unknown as {summarySaved:boolean}).summarySaved=false;
  const observer=new MutationObserver(()=>{
   if(document.querySelector('[data-testid="bee-accuracy"]')){
    const s=JSON.parse(localStorage.getItem(key)!);
    (window as unknown as {summarySaved:boolean}).summarySaved=s.screen==='complete'&&s.session.responses.length===6;
    observer.disconnect();
   }
  });observer.observe(document.body,{subtree:true,childList:true});
 },ACTIVE_KEY);
 await page.getByRole('dialog').getByRole('button',{name:'End Game',exact:true}).click();
 expect(await page.evaluate(()=>(window as unknown as {summarySaved:boolean}).summarySaved)).toBe(true);
 await page.reload();await expect(page.getByTestId('bee-accuracy')).toHaveText('16.7% (1/6)');
});
