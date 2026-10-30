import { test, expect } from '@playwright/test';
import { INITIAL_CUTOFF, eligible, selectCurriculum, schoolDate, currentPeriod, type CurriculumSelection } from '../src/curriculum/eligibility';
import { curriculumBank, generalBank, selectBank } from '../src/games/spelling-bee/bank';
import { answerFor, pictures, isWord, letterSlots, startingHints } from '../src/games/spelling-bee/words';
import { controlTimer, type BeeState, beginGame, committed, commitResults as timedCommit, currentWord, exhausted, extendGame, finishGame, isBeeState, letterChoices, nextWord, remaining, repeatCycle, revealAnotherLetter, toggleTeam as timedToggle, type StartOptions } from '../src/games/spelling-bee/engine';
import { readActive, saveActive, readHistory, saveHistory } from '../src/games/spelling-bee/storage';
import { summarizeSession } from '../src/assessment/engine';
import type { Grade } from '../src/types';
const now = '2026-10-09T14:00:00.000Z';
const config = (grade: Grade = '2', mode: CurriculumSelection['mode'] = 'mixed', cutoff = INITIAL_CUTOFF): CurriculumSelection => ({ grade, mode, cutoff, priorGrade: false });
const options = (selection = config()): StartOptions => ({ selection, reviewed: true, untilStop: true, choices: 0 });
function start(selection = config()) { return beginGame(selectBank(selection), selection.grade, 'missing', 'paced-game', now, () => .99, options(selection))!; }
function store() { const data = new Map<string,string>(); return { getItem:(k:string)=>data.get(k)??null, setItem:(k:string,v:string)=>{data.set(k,v);}, data }; }

test('October 9 boundary, future/unknown/conflicting timing and pending evidence fail closed', () => {
  const current = curriculumBank.find(w => w.grade === '2' && w.curriculum?.earliestEligible === INITIAL_CUTOFF)!.curriculum!;
  expect(eligible(current, '2026-10-08')).toBe(false);
  expect(eligible(current, INITIAL_CUTOFF)).toBe(true);
  for (const patch of [{ earliestEligible:'2026-10-10' }, { timing:'unknown' }, { timing:'conflicting' }, { review:'pending' }, { earliestEligible:null }, { periods:[] }]) expect(eligible({ ...current, ...patch } as typeof current, INITIAL_CUTOFF)).toBe(false);
  expect(eligible(current,'2026-02-30')).toBe(false);
  for (const word of curriculumBank.filter(w => ['conductor','insulator'].includes(w.word))) expect(eligible(word.curriculum,INITIAL_CUTOFF)).toBe(false);
  // The Kindergarten C date conflict was resolved from the school's lesson plans: C was taught Sept 23.
  const cat=curriculumBank.find(w=>w.id==='pacing-K-cat')!.curriculum;
  expect(eligible(cat,'2026-09-22')).toBe(false); expect(eligible(cat,'2026-09-23')).toBe(true);
});
test('dates and school timezone are deterministic and future dates are explicit', () => {
  expect(schoolDate(new Date('2026-10-10T02:00:00Z'))).toBe('2026-10-09');
  expect(currentPeriod(INITIAL_CUTOFF)).toEqual({start:'2026-10-05',end:'2026-10-09'});
  const before = selectBank(config('2','mixed','2026-10-08'));
  const after = selectBank(config());
  expect(after.length).toBeGreaterThan(before.length);
  expect(selectBank(config())).toEqual(after);
  expect(selectBank(config('5','mixed','2026-11-13')).some(w=>w.word==='conductor')).toBe(true);
  expect(selectBank(config('2','mixed','invalid'))).toEqual([]);
});
test('rolling modes distinguish current, review and unaligned general practice; legacy previous still selects', () => {
  const current=selectBank(config('2','current')), review=selectBank(config('2','review')), earlier=selectBank(config('2','previous')), mixed=selectBank(config()), general=selectBank(config('2','general'));
  expect(current).toHaveLength(24); expect(review).toHaveLength(16); expect(mixed).toHaveLength(40); expect(earlier).toHaveLength(28);
  expect(new Set([...current,...review].map(w=>w.id)).size).toBe(40);
  expect(general.every(w=>!w.curriculum)).toBe(true);
  expect(selectBank(config('K','current')).map(w=>w.word).sort()).toEqual(['can','cap','cat','kite','pan','pin']);
  const prior={...config('5'),priorGrade:true};
  expect(selectBank(prior).some(w=>w.grade==='4')).toBe(true);
  expect(selectBank(prior).some(w=>w.word==='conductor')).toBe(false);
  expect(selectBank({...config('1'),priorGrade:true}).every(w=>w.grade==='1')).toBe(true);
  expect(selectBank({...config('3','previous'),priorGrade:true}).every(w=>w.grade==='3')).toBe(true);
});
test('catalog is reviewed, uniquely identified, expanded and has explicit provenance', () => {
  const counts=[38,42,40,40,40,41];
  for (const [i,grade] of (['K','1','2','3','4','5'] as Grade[]).entries()) {
    const bank=selectBank(config(grade)); expect(bank).toHaveLength(counts[i]); expect(new Set(bank.map(w=>w.id)).size).toBe(bank.length);
    expect(generalBank.filter(w=>w.grade===grade).length).toBeGreaterThanOrEqual(30);
  }
  for(const w of curriculumBank) {expect(isWord(w)).toBe(true); expect(w.curriculum?.sourceUrl).toMatch(/^https:\/\/docs.google.com\//); expect(w.evidenceId).toBeTruthy();}
  for(const w of generalBank) expect(w.source).toContain('not verified');
});
test('Kindergarten uses multiple concrete objects per eligible initial, never a full-word default', () => {
  const s=start(config('K'));
  expect(s.words).toHaveLength(38); expect(new Set(s.words.map(w=>w.word)).size).toBe(38);
  for(const w of s.words) {expect(w.activity).toBe('initial'); expect(answerFor(w)).toHaveLength(1); expect(w.picture).toBeTruthy(); expect(pictures[w.picture!].src).toMatch(/\.webp$/); expect(w.clue).not.toContain(w.word); expect(letterSlots(answerFor(w),'supported')).toEqual(['_']); expect(letterChoices(w,3)).toContain(answerFor(w).toUpperCase()); expect(new Set(letterChoices(w,3)).size).toBe(3);}
  expect(revealAnotherLetter(s)).toBe(s);
  const committedState=commitResults(s,now);expect(committedState.session.questions[0].prompt).toMatch(/^[A-Z] — Beginning sound:/);
});
test('academic complexity adds support while challenge mode and single-letter tasks remain hidden', () => {
  const academic=curriculumBank.find(w=>w.word==='evidence')!;
  expect(startingHints(academic,'missing')).toHaveLength(1);
  expect(startingHints({...academic,complexity:'foundation'},'missing')).toEqual([]);
  expect(startingHints(academic,'challenge')).toEqual([]);
  expect(startingHints(start(config('K')).words[0],'missing')).toEqual([]);
});
test('teacher approval, malformed metadata, cross-grade and future entries cannot start a paced game', () => {
  const words=selectBank(config());
  expect(beginGame(words,'2','missing','x',now,Math.random,{...options(),reviewed:false})).toBeNull();
  expect(beginGame(curriculumBank.filter(w=>w.word==='conductor'),'5','missing','x',now,Math.random,options(config('5')))).toBeNull();
  expect(beginGame(words,'3','missing','x',now,Math.random,options(config('3')))).toBeNull();
  expect(beginGame(selectBank(config('2','general')),'2','missing','x',now,Math.random,options())).toBeNull();
});
test('balanced current/review sessions shuffle without duplicates and count only committed responses', () => {
  let s=start({...config('3'),priorGrade:true}); const seen=new Set<string>();
  const first=s.flow!.order.slice(0,3).map(id=>s.words.find(w=>w.id===id)!);
  expect(first.map(w=>w.grade)).toEqual(['3','3','2']);
  while(!exhausted(s)) {
    const w=currentWord(s);expect(seen.has(w.id)).toBe(false);seen.add(w.id);
    s=toggleTeam(s,'team-1');expect(summarizeSession(s.session).overall.attempts).toBe((seen.size-1)*6);
    s=commitResults(s,now);expect(commitResults(s,now)).toBe(s);expect(isBeeState(s)).toBe(true);
    s=nextWord(s,now);
  }
  expect(remaining(s)).toBe(0); expect(s.screen).toBe('play');
  expect(summarizeSession(s.session).teams[0].score).toBe(seen.size);
});
test('long sessions preserve scores and compact snapshots through ten explicit cycles and refresh', () => {
  let s=start(); const memory=store();
  for(let cycle=1;cycle<=10;cycle++) {
    const seen=new Set<string>();
    while(!exhausted(s)) { expect(seen.has(currentWord(s).id)).toBe(false);seen.add(currentWord(s).id);s=commitResults(toggleTeam(s,'team-1'),now);s=nextWord(s,now); }
    expect(saveActive(s,memory)).toBe('');s=readActive(memory).state!;
    expect(summarizeSession(s.session).teams[0].score).toBe(40*cycle);
    if(cycle<10)s=repeatCycle(s,()=>.3);
  }
  expect(s.words).toHaveLength(40);expect(s.session.questions).toHaveLength(400);expect(new Set(s.session.questions.map(q=>q.questionId)).size).toBe(400);
  expect(JSON.stringify(s).length).toBeLessThan(1500000);
  const ended=finishGame(s,now);expect(saveHistory(ended,memory)).toBe('');expect(readHistory(memory).states).toHaveLength(1);
});
test('exhaustion allows explicitly reviewed additions at original cutoff and rejects future expansion', () => {
  let s=start(config('2','current'));
  while(!exhausted(s))s=nextWord(commitResults(toggleTeam(s,'team-2'),now),now);
  expect(repeatCycle(s).flow!.cycle).toBe(2);
  expect(extendGame(s,selectBank(config('2','mixed','2026-11-13')),options(config('2','mixed','2026-11-13')),now)).toBe(s);
  const expanded=extendGame(s,selectBank(config()),options(),now,()=>.99);
  expect(expanded.words).toHaveLength(40);expect(expanded.index).toBe(24);expect(remaining(expanded)).toBe(16);expect(isBeeState(expanded)).toBe(true);
  expect(summarizeSession(expanded.session).teams[1].score).toBe(24);
  expect(committed(expanded)).toBe(false);
});
test('paced persistence rejects corrupt cycles, snapshots and future metadata without touching old records', () => {
  const s=commitResults(start(),now);
  for(const bad of [{...s,flow:{...s.flow,cycle:0}},{...s,flow:{...s.flow,order:[s.flow!.order[0],s.flow!.order[0]]}},{...s,index:999},{...s,flow:{...s.flow,offset:10}},{...s,words:s.words.map(w=>({...w,curriculum:{...w.curriculum!,timing:'unknown'}}))},{...s,correctTeamIds:['team-1']}])expect(isBeeState(bad)).toBe(false);
  const memory=store();memory.setItem('curricuplay.game.v1','unchanged');expect(saveActive(s,memory)).toBe('');expect(readActive(memory).state).toEqual(s);expect(memory.getItem('curricuplay.game.v1')).toBe('unchanged');
});

// Preserve the original scoring/regression scenarios using the explicit teacher early-end workflow.
function commitResults(s: BeeState, now: string) { return timedCommit(controlTimer(s, 'end', Date.parse(now)), now); }
function toggleTeam(s: BeeState, id: string) { return timedToggle(controlTimer(s, 'end'), id); }
