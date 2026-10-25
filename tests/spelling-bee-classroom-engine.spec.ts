import { test, expect } from '@playwright/test';
import { freshTimer, startTimer, pauseTimer, advanceTimer, endTimer, timerRemaining, isRoundTimer, formatTimer, timerDurations } from '../src/games/spelling-bee/timer';
import { beginGame, controlTimer, canScore, toggleTeam, commitResults, nextWord, isBeeState, revealAnotherLetter } from '../src/games/spelling-bee/engine';
import { parseWords, displayedSlots, displayedWord, isWord, samples } from '../src/games/spelling-bee/words';
import { readActive, saveActive, ACTIVE_KEY } from '../src/games/spelling-bee/storage';
import { readFileSync } from 'node:fs';
import { selectBank } from '../src/games/spelling-bee/bank';
import { pictures, answerFor } from '../src/games/spelling-bee/words';
import manifest from '../content/spelling-bee/photo-assets.json' with { type: 'json' };
const now = Date.parse('2026-10-09T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const start = () => beginGame(samples.entries, '5', 'challenge', 'timer-test', iso(now), () => .99)!;

test('all 36 eligible Kindergarten prompts and the reviewed foundation objects have local generated pictures', () => {
 const kindergarten=selectBank({grade:'K',mode:'mixed',cutoff:'2026-10-09',priorGrade:false});
 expect(kindergarten).toHaveLength(36);expect(manifest.assets).toHaveLength(51);
 for(const w of kindergarten){
  expect(w.picture).toBe(w.word);expect(answerFor(w)).toBe(w.word[0]);
  expect(pictures[w.picture!].src).toBe(`/spelling-bee/photos/${w.word}.webp`);
  expect(manifest.assets.some(a=>a.name===w.word)).toBe(true);
 }
 for(const asset of manifest.assets){
  expect(asset.prompt.length).toBeGreaterThan(50);
  expect(readFileSync(asset.path).subarray(8,12).toString()).toBe('WEBP');
 }
 // October Kindergarten photos (R, D and E weeks); elbow carries an added arrow.
 for(const word of ['rabbit','dog','door','desk','egg','elephant','elbow','envelope']){
  expect((pictures as Record<string,{src:string}>)[word].src).toBe(`/spelling-bee/photos/${word}.webp`);
  expect(manifest.assets.some(a=>a.name===word&&a.path===`public/spelling-bee/photos/${word}.webp`)).toBe(true);
 }
 for(const grade of ['1','2'] as const){
  const bank=selectBank({grade,mode:'mixed',cutoff:'2026-10-09',priorGrade:false});
  for(const w of bank.filter(w=>['mat','pin','cap','can','patch','string','strip','sprig','scrap','shrimp'].includes(w.word))) expect(pictures[w.picture!].src).toBe(`/spelling-bee/photos/${w.word}.webp`);
 }
});

test('all ten durations round up, pause accurately and expire using persisted wall-clock deadlines', () => {
 expect(timerDurations).toEqual([30,60,90,120,150,180,210,240,270,300]);
 for (const duration of timerDurations) {
  const ready=freshTimer(duration); expect(isRoundTimer(ready)).toBe(true);expect(ready.status).toBe('ready');
  const running=startTimer(ready,now); expect(timerRemaining(running,now+501)).toBe(duration*1000-501);expect(formatTimer(29999)).toBe('0:30');
  const paused=pauseTimer(running,now+1234);expect(paused.status).toBe('paused');expect(timerRemaining(paused,now+500000)).toBe(duration*1000-1234);
  const resumed=startTimer(JSON.parse(JSON.stringify(paused)),now+500000);expect(resumed.deadline).toBe(now+500000+duration*1000-1234);
  expect(advanceTimer(resumed,resumed.deadline!+3600000)).toMatchObject({status:'expired',remainingMs:0,deadline:null});
  expect(pauseTimer(running,running.deadline!)).toMatchObject({status:'expired'});
 }
});
test('Kindergarten scores immediately with new or historical timers and retains one-point scoring', () => {
 const words=selectBank({grade:'K',mode:'mixed',cutoff:'2026-10-09',priorGrade:false});
 const base=beginGame(words,'K','challenge','untimed-k',iso(now),()=>.99)!;
 expect(base.timer).toBeUndefined();
 for(const timer of [undefined,freshTimer(),startTimer(freshTimer(),now),pauseTimer(startTimer(freshTimer(),now),now+1),endTimer(freshTimer(),now),advanceTimer(startTimer(freshTimer(),now),now+300000)]){
  const s={...base,timer};expect(isBeeState(s)).toBe(true);expect(canScore(s,now)).toBe(true);
  expect(controlTimer(s,'start',now)).toBe(s);
  const marked=toggleTeam(s,'team-1',now),done=commitResults(marked,iso(now));
  expect(done.session.responses.map(r=>r.pointsAwarded)).toEqual([1,0,0,0,0,0]);
  expect(commitResults(done,iso(now))).toBe(done);expect(nextWord(done,iso(now)).timer).toBeUndefined();
  const store={getItem:()=>JSON.stringify(marked),setItem:()=>{}};
  expect(readActive(store).state?.correctTeamIds).toEqual(['team-1']);
 }
 expect(manifest.assets.reduce((bytes,a)=>bytes+a.bytes,0)).toBeLessThan(5*1024*1024);
});
test('accuracy-only scoring is gated in the engine, expires without auto-scoring, and commits once', () => {
 let s=start();expect(s.timer?.duration).toBe(300);expect(canScore(s,now)).toBe(false);
 expect(toggleTeam(s,'team-1',now)).toBe(s);expect(commitResults(s,iso(now))).toBe(s);
 s=controlTimer(s,'reset',now,30);s=controlTimer(s,'start',now);
 expect(controlTimer(s,'reset',now+1,60)).toBe(s);
 expect(canScore(s,now+29999)).toBe(false);expect(canScore(s,now+30000)).toBe(true);expect(s.session.responses).toEqual([]);
 s=toggleTeam(s,'team-1',now+30000);s=commitResults(s,iso(now+30000));expect(s.session.responses.map(r=>r.pointsAwarded)).toEqual([1,0,0,0,0,0]);expect(s.timer?.status).toBe('expired');
 expect(commitResults(s,iso(now+31000))).toBe(s);expect(controlTimer(s,'reset',now)).toBe(s);
 const next=nextWord(s,iso(now+31000));expect(next.timer).toEqual(freshTimer(30));expect(next.correctTeamIds).toEqual([]);expect(canScore(next,now+31000)).toBe(false);expect(isBeeState(next)).toBe(true);
});
test('teacher early end opens scoring with no speed bonus; reset clears draft marks only', () => {
 let s=controlTimer(start(),'end',now);s=toggleTeam(s,'team-2',now);expect(s.correctTeamIds).toEqual(['team-2']);
 const reset=controlTimer(s,'reset',now);expect(reset.correctTeamIds).toEqual([]);expect(reset.timer).toEqual(freshTimer());expect(reset.session).toEqual(s.session);
 s=commitResults(s,iso(now));expect(s.session.responses.find(r=>r.teamId==='team-2')?.pointsAwarded).toBe(1);
});
test('timer storage preserves deadlines, accepts historical saves and fails safely on corrupt timer data', () => {
 const data=new Map<string,string>();const store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const s=controlTimer(start(),'start',now);expect(saveActive(s,store)).toBe('');expect(readActive(store).state?.timer).toEqual(s.timer);
 expect(advanceTimer(readActive(store).state!.timer!,now+600000).status).toBe('expired');
 const legacy={...start()};delete legacy.timer;store.setItem(ACTIVE_KEY,JSON.stringify(legacy));expect(readActive(store).state?.timer).toEqual(freshTimer());
 legacy.correctTeamIds=['team-1'];store.setItem(ACTIVE_KEY,JSON.stringify(legacy));expect(readActive(store).state?.timer?.status).toBe('ended');expect(readActive(store).state?.correctTeamIds).toEqual(['team-1']);
 for(const timer of [{...freshTimer(),duration:31},{...freshTimer(),status:'running'},{...freshTimer(),remainingMs:-1},{...freshTimer(),deadline:'bad'}]){
  const raw=JSON.stringify({...s,timer});store.setItem(ACTIVE_KEY,raw);expect(readActive(store).error).toContain('untouched');expect(store.getItem(ACTIVE_KEY)).toBe(raw);
 }
});
test('hyphens remain visible, are never counted as letter hints, and preserve canonical answer metadata', () => {
 const w=parseWords('non-fiction | Writing about real people and facts. | text type', '5', true).entries[0];
 expect(w.word).toBe('nonfiction');expect(displayedWord(w)).toBe('non-fiction');expect(isWord(w)).toBe(true);
 expect(displayedSlots(w,'challenge').join('')).toBe('___-_______');expect(displayedSlots(w,'challenge',[],true).join('')).toBe('NON-FICTION');
 let s=beginGame([w],'5','challenge','punct',iso(now))!;
 for(let i=0;i<20;i++)s=revealAnotherLetter(s);
 expect(displayedSlots(w,'challenge',s.extraLetters).filter(c=>c==='_')).toHaveLength(1);expect(s.extraLetters?.every(i=>i<10)).toBe(true);
 const old={...w};delete old.displayWord;expect(displayedSlots(old,'challenge')).toEqual(displayedSlots(w,'challenge'));
 for(const displayWord of ['non--fiction','-nonfiction','nonfiction-','non fiction','<script>','non-fictio'])expect(isWord({...w,displayWord})).toBe(false);
 expect(parseWords('non-fiction,nonfiction','5',true).errors.join()).toContain('duplicate');
 expect(endTimer(freshTimer(),now).status).toBe('ended');
});
