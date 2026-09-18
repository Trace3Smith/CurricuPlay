import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import pack from '../src/data/four-corners.json' with { type: 'json' };
import parents from '../src/data/tomorrow-pack.json' with { type: 'json' };
import curriculum from '../src/data/curriculum.json' with { type: 'json' };
const key = 'curricuplay.four-corners.v1';
const labels: Record<string, string> = { K: 'Kindergarten', '1': '1st Grade', '2': '2nd Grade', '3': '3rd Grade', '4': '4th Grade', '5': '5th Grade' };
async function setup(page: Page, grade = 'K') {
  await page.clock.setFixedTime(new Date('2026-09-17T12:00:00'));
  await page.goto('/'); await page.getByRole('button', { name: /FOUR CORNERS/ }).click();
  await page.getByRole('button', { name: labels[grade], exact: true }).click();
  // These regressions exercise the preserved whole-class mode; Team Mode is now the default.
  await page.getByRole('button', { name: 'Classic Mode', exact: true }).click();
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.fc-game h1, .fc-choice, .fc-controls button, .fc-prompt img').evaluateAll(elements => elements.every(e => {
    const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && e.scrollHeight <= e.clientHeight + 1;
  }))).toBe(true);
}
test('Four Corners content: preserved baseline, provenance, four choices and expanded coverage', () => {
  const baseline = JSON.parse(fs.readFileSync('content/four-corners/mvp-baseline.json', 'utf8'));
  const audit = JSON.parse(fs.readFileSync('content/four-corners/quality-audit.json', 'utf8')).records;
  expect(pack).toEqual(audit.filter((r: any) => r.after).map((r: any) => r.after));
  for (const r of audit.filter((r: any) => r.disposition === 'preserved')) expect(r.after).toEqual(r.before);
  expect(pack).toHaveLength(264); expect(new Set(pack.map(q => q.id)).size).toBe(264);
  expect(new Set(pack.map(q => q.question.toLowerCase())).size).toBe(264);
  const counts = [0, 0, 0, 0];
  for (const q of pack) {
    const parent = parents.find(p => p.id === q.originId)!;
    expect(parent).toBeTruthy(); expect(parent.reviewStatus).toBe('approved');
    expect(q.grade).toBe(parent.grade); expect(q.subject).toBe(parent.subject); expect(q.subject).not.toBe('Math');
    expect(q.weekIntroduced <= '2026-09-13' && q.alignedWeeks.every(w => w <= '2026-09-13')).toBe(true);
    expect(curriculum.some(c => c.id === q.curriculumId && c.grade === q.grade && c.subject === q.subject && c.weekOf === q.weekIntroduced)).toBe(true);
    const evidence = JSON.parse(fs.readFileSync(`content/sources/${q.evidence.document}`, 'utf8'));
    expect(evidence.content).toContain(q.evidence.quote);
    expect(q.choices).toHaveLength(4); expect(new Set(q.choices).size).toBe(4);
    expect(q.choices.filter(c => c === q.answer)).toHaveLength(1); expect(q.choices[q.correctIndex]).toBe(q.answer);
    expect(q.requiresExternalClassroomMaterial).toBe(false); expect(q.question.length).toBeLessThanOrEqual(240);
    expect(q.choices.every(c => c.length <= 95)).toBe(true); counts[q.correctIndex]++;
    if ('visual' in q && q.visual) { expect(q.visual.alt.length).toBeGreaterThan(15); expect(fs.existsSync(`public${q.visual.src}`)).toBe(true); }
  }
  expect(counts).toEqual([67, 66, 65, 66]);
  for (const grade of Object.keys(labels)) expect(pack.filter(q => q.grade === grade)).toHaveLength(grade === 'K' ? 40 : grade === '1' ? 44 : 45);
});
for (const grade of Object.keys(labels)) test(`Four Corners ${grade}: complete real 15-round game, recovery and controls`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, grade);
  await expect(page.getByRole('button', { name: '15 rounds', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^30 rounds/ })).toBeEnabled();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  const seen = new Set<string>(); const subjects: string[] = [];
  for (let round = 0; round < 15; round++) {
    const s = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    const q = pack.find(q => q.id === s.questionIds[round])!;
    expect(q.grade).toBe(grade); expect(seen.has(q.id)).toBe(false); seen.add(q.id); subjects.push(q.subject);
    expect(s.usedQuestionIds).toEqual(s.questionIds.slice(0, round + 1));
    await expect(page.getByText(`Round ${round + 1} of 15`, { exact: true })).toBeVisible();
    await expect(page.locator('.fc-choice')).toHaveCount(4); await expect(page.locator('.fc-correct')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next Question', exact: true })).toHaveCount(0);
    await expect(page.locator('.fc-game h1')).toHaveText(q.question);
    await fits(page);
    if ('visual' in q && q.visual) {
      await expect(page.getByRole('img', { name: q.visual.alt })).toBeVisible();
      expect(await page.locator('.fc-prompt img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await page.screenshot({ path: 'test-results/four-corners-visual.png' });
    } else await expect(page.locator('.fc-prompt img')).toHaveCount(0);
    if (round === 0) { await page.reload(); await expect(page.locator('.fc-game h1')).toHaveText(q.question); await expect(page.locator('.fc-correct')).toHaveCount(0); }
    await page.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
    await expect(page.locator('.fc-correct')).toHaveCount(1); await expect(page.locator('.fc-correct > span')).toHaveText(q.answer); await fits(page);
    if (round === 0) { await page.reload(); await expect(page.locator('.fc-correct > span')).toHaveText(q.answer); await page.screenshot({ path: `test-results/four-corners-${grade}-revealed.png` }); }
    await page.getByRole('button', { name: round === 14 ? 'Finish Game' : 'Next Question', exact: true }).click();
  }
  for (const subject of ['Science', 'Social Studies', 'Literacy']) expect(subjects.filter(s => s === subject)).toHaveLength(5);
  expect(subjects.every((s, i) => i < 2 || s !== subjects[i - 1] || s !== subjects[i - 2])).toBe(true);
  await expect(page.getByRole('heading', { name: 'All 15 rounds complete!' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'All 15 rounds complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Game', exact: true }).click();
  await expect(page.getByText('Round 1 of 15', { exact: true })).toBeVisible(); await expect(page.locator('.fc-correct')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /FOUR CORNERS/ }).click(); await expect(page.getByText('Round 1 of 15', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Round 1 of 15', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('button', { name: labels[grade === 'K' ? '1' : 'K'], exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  await expect(page.locator('.fc-meta')).toContainText(labels[grade === 'K' ? '1' : 'K']); expect(errors).toEqual([]);
});
for (const grade of Object.keys(labels)) test(`Four Corners ${grade}: all available single-subject modes`, async ({ page }) => {
  test.setTimeout(60000); await setup(page, grade);
  for (const mix of ['Science', 'Social Studies', 'Reading / ELA']) {
    const subject = mix === 'Reading / ELA' ? 'Literacy' : mix;
    const count = pack.filter(q => q.grade === grade && q.subject === subject).length;
    await page.getByRole('button', { name: mix, exact: true }).click();
    await expect(page.getByText(`${count} eligible unique questions`)).toBeVisible();
    for (const rounds of [10, 15, 20, 30]) {
      const option = page.getByRole('button', { name: new RegExp(`^${rounds} rounds`) });
      if (count < rounds) { await expect(option).toBeDisabled(); continue; }
      await option.click(); await page.reload(); await expect(option).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: /^Start Game/ }).click();
      const seen = new Set<string>();
      for (let i = 0; i < rounds; i++) {
        const s = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
        const q = pack.find(q => q.id === s.questionIds[i])!; expect(q.subject).toBe(subject); expect(seen.has(q.id)).toBe(false); seen.add(q.id);
        await page.getByRole('button', { name: 'Reveal Answer' }).click(); await expect(page.locator('.fc-correct > span')).toHaveText(q.answer); await fits(page);
        await page.getByRole('button', { name: i === rounds - 1 ? 'Finish Game' : 'Next Question' }).click();
      }
      await page.getByRole('button', { name: 'Change Setup' }).click();
    }
  }
});
for (const grade of Object.keys(labels)) for (const mode of [30, 'all'] as const) test(`Four Corners ${grade}: ${mode === 'all' ? 'until exhaustion' : '30 rounds'} complete mixed game`, async ({ page }) => {
  test.setTimeout(60000); await setup(page, grade);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: mode === 'all' ? 'Play Until I Stop' : '30 rounds', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: mode === 'all' ? 'Play Until I Stop' : '30 rounds', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Start Game/ }).click();
  const initial = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  const count = mode === 'all' ? pack.filter(q => q.grade === grade).length : mode;
  expect(initial.questionIds).toHaveLength(count); expect(new Set(initial.questionIds).size).toBe(count);
  const subjects = initial.questionIds.map((id: string) => pack.find(q => q.id === id)!.subject);
  if (mode === 30) for (const subject of ['Science', 'Social Studies', 'Literacy']) expect(subjects.filter((s: string) => s === subject)).toHaveLength(10);
  if (mode === 'all') expect([...initial.questionIds].sort()).toEqual(pack.filter(q => q.grade === grade).map(q => q.id).sort());
  // No adjacent subject repeats are necessary for these real pools.
  expect(subjects.every((s: string, i: number) => i === 0 || s !== subjects[i - 1])).toBe(true);
  const seen = new Set<string>(); let visuals = 0; let textOnly = 0;
  for (let i = 0; i < count; i++) {
    const s = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
    const q = pack.find(q => q.id === s.questionIds[i])!;
    expect(q.grade).toBe(grade); expect(q.weekIntroduced <= '2026-09-13').toBe(true);
    expect(seen.has(q.id)).toBe(false); seen.add(q.id); expect(s.questionIds).toEqual(initial.questionIds);
    expect(s.usedQuestionIds).toEqual(initial.questionIds.slice(0, i + 1));
    await expect(page.getByText(mode === 'all' ? `Round ${i + 1}` : `Round ${i + 1} of 30`, { exact: true })).toBeVisible();
    await expect(page.locator('.fc-game h1')).toHaveText(q.question); await expect(page.locator('.fc-correct')).toHaveCount(0); await fits(page);
    if ('visual' in q && q.visual) {
      visuals++; await expect(page.getByRole('img', { name: q.visual.alt })).toBeVisible();
      expect(await page.locator('.fc-prompt img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      if (mode === 'all') await page.screenshot({ path: `test-results/${q.id}.png` });
    } else { textOnly++; await expect(page.locator('.fc-prompt img')).toHaveCount(0); }
    if (i === 0 || i === 12) { await page.reload(); await expect(page.locator('.fc-game h1')).toHaveText(q.question); await expect(page.locator('.fc-correct')).toHaveCount(0); }
    await page.getByRole('button', { name: 'Reveal Answer' }).click(); await expect(page.locator('.fc-correct > span')).toHaveText(q.answer); await fits(page);
    if (i === 12) { await page.reload(); await expect(page.locator('.fc-correct > span')).toHaveText(q.answer); }
    await page.getByRole('button', { name: mode !== 'all' && i === count - 1 ? 'Finish Game' : 'Next Question', exact: true }).click();
  }
  expect(textOnly).toBeGreaterThan(0); if (mode === 'all') expect(visuals).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: mode === 'all' ? 'Every question explored!' : 'All 30 rounds complete!' })).toBeVisible();
  if (mode === 'all') await expect(page.getByText("You've used every available question in this content pool.", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: mode === 'all' ? 'Every question explored!' : 'All 30 rounds complete!' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Until-stop ends early, persists, resets, and supports a small single-subject pool', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Science', exact: true }).click();
  await page.getByRole('button', { name: 'Play Until I Stop', exact: true }).click(); await page.getByRole('button', { name: /^Start Game/ }).click();
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.getByRole('button', { name: 'Next Question' }).click(); }
  await page.getByRole('button', { name: 'End Game', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Game ended.' })).toBeVisible();
  await expect(page.getByText("You've used every available question in this content pool.", { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Game ended.' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Again' }).click(); await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
  const s = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); expect(s.questionIds).toHaveLength(10); expect(s.usedQuestionIds).toHaveLength(1); expect(s.endedEarly).toBe(false);
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Reset Game', exact: true }).click();
  await expect(page.getByText('Round 1', { exact: true })).toBeVisible();
  for (let i = 0; i < 10; i++) { await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.getByRole('button', { name: 'Next Question' }).click(); }
  await expect(page.getByText("You've used every available question in this content pool.", { exact: true })).toBeVisible();
});
test('Four Corners queue redistributes scarce subjects, supports single subjects, and excludes future content', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite module
    const e = await import('/src/games/four-corners/engine.ts');
    const pool = e.eligible('K', 'Mixed Academic');
    const scarce = pool.filter((q: any) => q.subject !== 'Science' || q.id === pool[0].id);
    const ids = e.buildQueue(scarce, 10, () => 0.42);
    const qs = ids.map((id: string) => pool.find((q: any) => q.id === id));
    return { beforeSchool: e.eligible('K', 'Mixed Academic', '2026-07-01').length, ids, counts: ['Science', 'Social Studies', 'Literacy'].map(s => qs.filter((q: any) => q.subject === s).length), short: e.buildQueue(pool, 100), single: e.buildQueue(pool.filter((q: any) => q.subject === 'Science'), 5).length };
  });
  expect(result.beforeSchool).toBe(0); expect(new Set(result.ids).size).toBe(10); expect(result.counts[0]).toBe(1); expect(result.counts.slice(1).sort()).toEqual([4, 5]); expect(result.short).toEqual([]); expect(result.single).toBe(5);
});
test('Four Corners invalid saved sessions fail safely; teacher veto and storage failure', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  const good = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  for (const patch of [{ questionIds: ['missing'] }, { currentRound: 99 }, { usedQuestionIds: [] }, { revealed: 'yes' }, { questionIds: Array(15).fill(good.questionIds[0]) }, { grade: '9' }]) {
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state: { ...good, ...patch } });
    await page.reload(); await expect(page.getByRole('button', { name: /^Start Game/ })).toBeVisible();
  }
  const parent = pack.find(q => q.id === good.questionIds[0])!.originId;
  await page.evaluate(({ key, good, parent }) => {
    localStorage.setItem(key, JSON.stringify(good));
    localStorage.setItem('curricuplay.reviews.v1', JSON.stringify({ version: 1, decisions: { [parent]: { status: 'rejected', original: '{}', question: '', answer: '', reviewedAt: '' } } }));
  }, { key, good, parent });
  await page.reload(); await expect(page.getByRole('button', { name: /^Start Game/ })).toBeVisible();
  const expected = pack.filter(q => q.grade === 'K' && q.originId !== parent && (!('adaptation' in q) || q.adaptation?.sourceQuestionId !== parent)).length;
  await expect(page.getByText(`${expected} eligible unique questions`)).toBeVisible();
  await page.evaluate(() => { localStorage.clear(); Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await page.getByRole('button', { name: '1st Grade', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Progress cannot be saved');
});
test('Four Corners leaves an active Jeopardy game intact and fullscreen works', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-17T12:00:00')); await page.goto('/');
  await page.getByRole('button', { name: /JEOPARDY/ }).click(); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.locator('.tile:not([disabled])').first().click(); await page.getByRole('button', { name: 'Reveal Answer' }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!));
  await page.getByRole('button', { name: 'Home', exact: true }).click(); await page.getByRole('button', { name: /FOUR CORNERS/ }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click(); await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: 'Full Screen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.getByRole('button', { name: 'Home', exact: true }).click(); await page.getByRole('button', { name: /JEOPARDY/ }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('curricuplay.game.v1')!)); expect(after).toEqual(before);
});

test('Legacy MVP saves survive expansion; incomplete until-stop queues are rejected', async ({ page }) => {
  await setup(page);
  const baseline = JSON.parse(fs.readFileSync('content/four-corners/mvp-baseline.json', 'utf8')).filter((q: any) => q.grade === '2');
  const legacy = { version: 1, screen: 'play', grade: '2', mix: 'Mixed Academic', rounds: 15, currentRound: 2, questionIds: baseline.map((q: any) => q.id), usedQuestionIds: baseline.slice(0, 3).map((q: any) => q.id), revealed: true };
  await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)), { key, legacy });
  await page.reload(); await expect(page.getByText('Round 3 of 15', { exact: true })).toBeVisible();
  await expect(page.locator('.fc-correct > span')).toHaveText(baseline[2].answer);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)).toEqual(legacy);
  await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify({ ...legacy, rounds: 'all' })), { key, legacy });
  await page.reload(); await expect(page.getByRole('button', { name: /^Start Game/ })).toBeVisible();
});

test('Quality audit separates printed letter matching and rejects withdrawn recognition saves', async ({ page }) => {
  await setup(page);
  const ids = pack.filter(q => q.grade === 'K').slice(0, 15).map(q => q.id);
  const matching = pack.find(q => q.id === 'fc-tomorrow-dcss-K-literacy-letter-match')!;
  const index = ids.indexOf(matching.id);
  expect(index).toBeGreaterThanOrEqual(0);
  const state = { version: 1, screen: 'play', grade: 'K', mix: 'Mixed Academic', rounds: 15, currentRound: index, questionIds: ids, usedQuestionIds: ids.slice(0, index + 1), revealed: false };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
  await page.reload();
  await expect(page.locator('.fc-read')).toHaveText('LOOK AT THE PRINTED LETTERS · TEACHER READS THE QUESTION ONLY');
  await fits(page);
  await page.screenshot({ path: 'test-results/four-corners-letter-delivery.png' });
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await expect(page.locator('.fc-correct > span')).toHaveText(matching.answer);
  await fits(page);
  const withdrawn = JSON.parse(fs.readFileSync('content/four-corners/quality-audit.json', 'utf8')).records.filter((r: any) => r.disposition === 'withdrawn');
  expect(withdrawn).toHaveLength(6);
  for (const row of withdrawn) expect(pack.some(q => q.id === row.id)).toBe(false);
  state.questionIds[index] = 'fc-tomorrow-dcss-K-literacy-word-you';
  state.usedQuestionIds = state.questionIds.slice(0, index + 1);
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
  await page.reload();
  await expect(page.getByRole('button', { name: /^Start Game/ })).toBeVisible();
  await expect(page.locator('.fc-game')).toHaveCount(0);
});

test('Printed-letter rounds label corners with shapes; every other question keeps A/B/C/D', async ({ page }) => {
  const tokens = ['●', '▲', '■', '◆'];
  const printItems = pack.filter(q => 'delivery' in q && q.delivery === 'look-at-print');
  // The whole point of the scheme is that it covers exactly the letter-content questions.
  expect(printItems).toHaveLength(4);
  for (const q of printItems) expect(q.grade).toBe('K');
  for (const q of pack) {
    const letters = q.choices.every(c => /^[A-Za-z]$/.test(c.trim()) || /^[A-Za-z] and [A-Za-z]$/.test(c.trim()));
    expect(letters).toBe('delivery' in q && q.delivery === 'look-at-print');
  }
  await setup(page, 'K');
  const kIds = pack.filter(q => q.grade === 'K').map(q => q.id);
  for (const q of printItems) {
    const ids = [q.id, ...kIds.filter(id => id !== q.id)].slice(0, 15);
    const state = { version: 1, screen: 'play', grade: 'K', mix: 'Mixed Academic', rounds: 15, currentRound: 0, questionIds: ids, usedQuestionIds: [q.id], revealed: false };
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
    await page.reload();
    await expect(page.locator('.fc-game h1')).toHaveText(q.question);
    await expect(page.locator('.fc-choice-print')).toHaveCount(4);
    // No bare letter label survives on these rounds: the corner reads as a worded sign.
    await expect(page.locator('.fc-choice > b:not(.fc-corner)')).toHaveCount(0);
    for (let i = 0; i < 4; i++) {
      const tile = page.locator('.fc-choice').nth(i);
      await expect(tile.locator('b.fc-corner')).toHaveText(`${tokens[i]}Corner ${'ABCD'[i]}`);
      await expect(tile.locator('i.fc-token')).toHaveAttribute('aria-hidden', 'true');
      await expect(tile.locator('span.fc-letter')).toHaveText(q.choices[i]);
    }
    await fits(page);
    await page.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
    await expect(page.locator('.fc-correct')).toHaveCount(1);
    await expect(page.locator('.fc-correct > span')).toHaveText(q.answer);
    await expect(page.locator('.fc-controls p')).toContainText(`Correct answer: ${tokens[q.correctIndex]} corner ${'ABCD'[q.correctIndex]}`);
    await fits(page);
    await page.screenshot({ path: `test-results/four-corners-print-${q.id}.png` });
  }
  // A neighbouring K literacy question with word choices is untouched.
  const plain = pack.find(q => q.grade === 'K' && q.subject === 'Literacy' && !('delivery' in q && q.delivery === 'look-at-print'))!;
  const ids = [plain.id, ...kIds.filter(id => id !== plain.id)].slice(0, 15);
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state: { version: 1, screen: 'play', grade: 'K', mix: 'Mixed Academic', rounds: 15, currentRound: 0, questionIds: ids, usedQuestionIds: [plain.id], revealed: false } });
  await page.reload();
  await expect(page.locator('.fc-choice-print')).toHaveCount(0);
  await expect(page.locator('.fc-choice > b')).toHaveText(['A', 'B', 'C', 'D']);
  await page.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
  await expect(page.locator('.fc-controls p')).toContainText(`Correct answer: ${'ABCD'[plain.correctIndex]} —`);
  await fits(page);
});
