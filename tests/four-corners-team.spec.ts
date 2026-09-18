import { test, expect, type Page } from '@playwright/test';
import pack from '../src/data/four-corners.json' with { type: 'json' };
const key = 'curricuplay.four-corners.v1';
const historyKey = 'curricuplay.sessions.v1';
const colorNames = ['Orange', 'Purple', 'Green', 'Yellow', 'Red', 'Blue'];
const teamName = (number: number, count = 6) => count === 6 ? colorNames[number - 1] : `Team ${number}`;
const labels: Record<string, string> = { K: 'Kindergarten', '1': '1st Grade', '2': '2nd Grade', '3': '3rd Grade', '4': '4th Grade', '5': '5th Grade' };
async function setup(page: Page, grade = 'K', count = 6) {
  await page.clock.setFixedTime(new Date('2026-09-17T12:00:00'));
  await page.goto('/#four-corners');
  await expect(page.getByRole('button', { name: 'Team Mode · Recommended for PE' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Play Until I Stop', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Team count')).toHaveValue('6');
  await page.getByRole('button', { name: labels[grade], exact: true }).click();
  await page.getByLabel('Team count').selectOption(String(count));
}
async function state(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); }
async function fits(page: Page, selector = '.fc-game h1, .fc-choice, .fc-controls button, .fc-prompt img, .fc-scoreboard, .fc-team-buttons button, .header-actions button, .fc-timer-count, .fc-timer-buttons button') {
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const over = await page.locator(selector).evaluateAll(elements => elements.filter(e => {
    const r = e.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth || e.scrollHeight > e.clientHeight + 1;
  }).map(e => ({ text: e.textContent, rect: e.getBoundingClientRect().toJSON(), scroll: e.scrollHeight, client: e.clientHeight })));
  expect(over).toEqual([]);
}
async function end(page: Page) {
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('The current question and its pending points will not count.');
  await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session Report', exact: true })).toBeVisible();
}
test('Team scoring toggles, clears, recovers, and commits only on Next; live view leaves play intact', async ({ page }) => {
  await setup(page); await page.getByLabel('Movement timer duration').selectOption('0');
  await page.getByRole('button', { name: /^Start Game/ }).click();
  await expect(page.getByRole('button', { name: teamName(1), exact: true })).toBeDisabled();
  expect((await state(page)).session.responses).toHaveLength(0);
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expect(page.getByTestId('overall-accuracy')).toHaveText('—');
  await expect(page.getByTestId('completed-questions')).toHaveText('0');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: teamName(1), exact: true }).click();
  await expect(page.getByTestId('score-team-1')).toHaveText('Orange 1');
  await expect(page.getByRole('button', { name: `${teamName(1)} ✓ +1`, exact: true })).toHaveCSS('background-color', 'rgb(178, 245, 215)');
  await page.getByRole('button', { name: `${teamName(1)} ✓ +1`, exact: true }).click();
  await expect(page.getByTestId('score-team-1')).toHaveText('Orange 0');
  await page.getByRole('button', { name: teamName(2), exact: true }).click();
  await page.getByRole('button', { name: 'Clear Round', exact: true }).click();
  expect((await state(page)).correctTeamIds).toEqual([]);
  await page.getByRole('button', { name: teamName(1), exact: true }).click();
  await page.getByRole('button', { name: teamName(6), exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: `${teamName(1)} ✓ +1`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).session.responses).toHaveLength(0);
  await fits(page); await page.screenshot({ path: 'test-results/team-mode-scoring.png' });
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  const s = await state(page);
  expect(s.session.responses).toHaveLength(6); expect(s.session.questions).toHaveLength(1);
  expect(s.session.responses.map((r: any) => r.correct)).toEqual([true, false, false, false, false, true]);
  expect(s.session.responses.map((r: any) => r.pointsAwarded)).toEqual([1, 0, 0, 0, 0, 1]);
  const q = pack.find(q => q.id === s.questionIds[0])!;
  expect(s.session.questions[0]).toMatchObject({ questionId: q.id, subject: q.subject, prompt: q.question });
  expect(s.session.questions[0].standards).toEqual(q.standard ? [q.standard] : undefined);
  await page.reload(); expect((await state(page)).session).toEqual(s.session);
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expect(page.getByTestId('overall-accuracy')).toHaveText('33.3% (2/6)');
  await expect(page.getByTestId('completed-questions')).toHaveText('1');
  await expect(page.getByTestId('response-attempts')).toHaveText('6');
  await page.getByRole('button', { name: 'Team Performance', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Team Performance', exact: true })).toHaveCSS('background-color', 'rgb(178, 245, 215)');
  await expect(page.locator('.assessment-team-grid article').first()).toContainText('100% (1/1)');
  await fits(page, '.assessment-modal, .assessment-team-grid article, .assessment-close');
  await page.screenshot({ path: 'test-results/team-live-assessment.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Round 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Round 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: teamName(2), exact: true }).click();
  await end(page);
  const completed = await state(page);
  expect(completed.session.responses).toEqual(s.session.responses);
  expect(completed.session.questions).toEqual(s.session.questions);
  await expect(page.getByTestId('overall-accuracy')).toHaveText('33.3% (2/6)');
  await fits(page, '.assessment-view, .assessment-report-actions button');
  await page.screenshot({ path: 'test-results/team-session-report.png' });
  await page.reload(); await expect(page.getByTestId('completed-questions')).toHaveText('1');
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), historyKey)).sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Change Setup', exact: true }).click();
  await page.getByRole('button', { name: 'Session History', exact: true }).click();
  await page.locator('.assessment-history-list button').first().click();
  await expect(page.getByTestId('overall-accuracy')).toHaveText('33.3% (2/6)');
  await page.getByRole('button', { name: 'Question Insights', exact: true }).click();
  await expect(page.locator('.assessment-question-list')).toContainText(q.question);
});
for (const [grade, teams] of [['K', 6], ['1', 1], ['2', 8], ['3', 12], ['4', 6], ['5', 6]] as const) test(`Team Mode grade ${grade}: ${teams} teams exhaust the real pool without repeats or overflow`, async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, grade, teams); await page.getByRole('button', { name: /^Start Game/ }).click();
  const initial = await state(page); const ids = initial.questionIds;
  expect(new Set(ids).size).toBe(ids.length); expect(ids).toHaveLength(pack.filter(q => q.grade === grade).length);
  const subjects = ids.map((id: string) => pack.find(q => q.id === id)!.subject);
  expect(subjects.every((s: string, i: number) => !i || s !== subjects[i - 1])).toBe(true);
  for (let i = 0; i < ids.length; i++) {
    await expect(page.getByText(`Round ${i + 1}`, { exact: true })).toBeVisible();
    await fits(page);
    const q = pack.find(q => q.id === ids[i])!;
    await expect(page.locator('.fc-game h1')).toHaveText(q.question);
    if ('visual' in q && q.visual) expect(await page.locator('.fc-prompt img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    await expect(page.locator('.fc-correct > span')).toHaveText(q.answer);
    await page.getByRole('button', { name: teamName(1, teams), exact: true }).click();
    await fits(page);
    if (i === 0 && teams === 12) await page.screenshot({ path: 'test-results/team-twelve-gameplay.png' });
    if (i === 7) { await page.reload(); await expect(page.getByRole('button', { name: `${teamName(1, teams)} ✓ +1` })).toHaveAttribute('aria-pressed', 'true'); }
    await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  await expect(page.getByText("You've used every available question in this content pool.", { exact: true })).toBeVisible();
  const final = await state(page);
  expect(final.session.questions.map((q: any) => q.questionId)).toEqual(ids);
  expect(final.session.responses).toHaveLength(ids.length * teams);
  expect(final.session.responses.filter((r: any) => r.correct)).toHaveLength(ids.length);
  expect(final.session.responses.every((r: any) => r.subject === pack.find(q => q.id === r.questionId)!.subject)).toBe(true);
  await page.getByRole('button', { name: 'Team Performance', exact: true }).click();
  await fits(page, '.assessment-team-grid article, .assessment-paging button');
  await page.reload(); expect((await state(page)).session).toEqual(final.session);
  expect(errors).toEqual([]);
});
for (const revealed of [false, true]) test(`End Game before first commit excludes a ${revealed ? 'revealed' : 'hidden'} question in fixed-round mode`, async ({ page }) => {
  await setup(page, '5', 1); await page.getByRole('button', { name: '10 rounds', exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  if (revealed) { await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.getByRole('button', { name: teamName(1, 1), exact: true }).click(); }
  await end(page); const s = await state(page);
  expect(s.session.questions).toHaveLength(0); expect(s.session.responses).toHaveLength(0);
  await expect(page.getByTestId('overall-accuracy')).toHaveText('—');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Session Report', exact: true })).toBeVisible();
});

test('History survives a new browser context, stays immutable, and reports a dynamic subject', async ({ page, browser }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  await end(page);
  const history = await page.evaluate(key => localStorage.getItem(key)!, historyKey);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(({ key, history }) => localStorage.setItem(key, history), { key: historyKey, history });
  const fresh = await context.newPage();
  await fresh.goto('/#four-corners');
  await fresh.getByRole('button', { name: 'Session History', exact: true }).click();
  await fresh.locator('.assessment-history-list button').first().click();
  await expect(fresh.getByTestId('response-attempts')).toHaveText('6');
  await context.close();
  // Generic history/report reads subject snapshots, independently of the Four Corners bank.
  const generic = JSON.parse(history); const session = generic.sessions[0];
  session.id = 'future-math'; session.gameType = 'jeopardy';
  session.questions[0].subject = 'Math'; session.responses.forEach((r: any) => { r.subject = 'Math'; });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: historyKey, value: JSON.stringify(generic) });
  await page.getByRole('button', { name: 'Session History', exact: true }).click();
  await page.locator('.assessment-history-list button', { hasText: 'jeopardy' }).click();
  await expect(page.locator('.assessment-modal .assessment-subjects')).toContainText('Math');
  await expect(page.locator('.assessment-modal .assessment-subjects')).toContainText('0% (0/6)');
});
test('History storage failure leaves the completed report recoverable; corrupt history is not overwritten', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (k === key) throw new Error('quota'); original.call(this, k, v); };
  }, historyKey);
  await end(page);
  await expect(page.getByRole('alert')).toContainText('Session History could not be saved');
  await expect(page.getByRole('button', { name: 'Play Again', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Session Report', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions.length, historyKey)).toBe(1);
  await page.getByRole('button', { name: 'Play Again', exact: true }).click();
  await page.evaluate(key => localStorage.setItem(key, '{broken history'), historyKey);
  await end(page);
  await expect(page.getByRole('alert')).toContainText('Existing stored data has been left untouched');
  expect(await page.evaluate(key => localStorage.getItem(key), historyKey)).toBe('{broken history');
});
test('Fixed Team game commits its last question once; report pages and reset preserve history', async ({ page }) => {
  await setup(page, '5', 12); await page.getByRole('button', { name: '10 rounds', exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    await page.getByRole('button', { name: 'Team 12', exact: true }).click();
    await page.getByRole('button', { name: i === 9 ? 'Finish Game' : 'Next Question', exact: true }).click();
  }
  await expect(page.getByTestId('completed-questions')).toHaveText('10');
  await expect(page.getByTestId('response-attempts')).toHaveText('120');
  const snapshot = (await state(page)).session;
  await page.reload(); expect((await state(page)).session).toEqual(snapshot);
  for (const tab of ['Class Performance', 'Team Performance', 'Question Insights']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await fits(page, '.assessment-body article, .assessment-paging button');
    const next = page.getByRole('button', { name: 'Next Page', exact: true });
    while (await next.count() && await next.isEnabled()) { await next.click(); await fits(page, '.assessment-body article, .assessment-paging button'); }
  }
  await page.getByRole('button', { name: 'Play Again', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: teamName(2, 12), exact: true }).click();
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Game', exact: true }).click();
  const reset = await state(page);
  expect(reset.session.questions).toHaveLength(0); expect(reset.session.responses).toHaveLength(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions.map((s: any) => s.questions.length), historyKey)).toEqual([1, 10]);
});
test('Corrupt team draft or response data cannot restore a scored game', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  const good = await state(page);
  for (const patch of [{ correctTeamIds: ['unknown'] }, { correctTeamIds: ['team-1', 'team-1'] }, { teamCount: 99 }, { session: { ...good.session, responses: [] } }]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: { ...good, ...patch } });
    await page.reload(); await expect(page.getByRole('button', { name: /^Start Game/ })).toBeVisible();
  }
});

for (const completedRounds of [17, 23, 41]) test(`Teacher stops at exactly ${completedRounds} committed rounds; pending marks stay out`, async ({ page }) => {
  test.setTimeout(90000);
  await setup(page, '5');
  if (completedRounds === 17) await page.getByRole('button', { name: '30 rounds', exact: true }).click();
  await page.getByRole('button', { name: /^Start Game/ }).click();
  for (let i = 0; i < completedRounds; i++) {
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    for (let t = 1; t <= (i % 2 ? 4 : 6); t++) await page.getByRole('button', { name: teamName(t), exact: true }).click();
    await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  const committed = (await state(page)).session;
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: teamName(1), exact: true }).click();
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expect(page.getByTestId('completed-questions')).toHaveText(String(completedRounds));
  await page.getByRole('button', { name: 'Team Performance', exact: true }).click();
  await fits(page, '.assessment-modal, .assessment-team-grid article, .assessment-close');
  if (completedRounds === 17) await page.screenshot({ path: 'test-results/team-live-assessment-real.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await end(page);
  expect((await state(page)).session.responses).toEqual(committed.responses);
  expect((await state(page)).session.questions).toEqual(committed.questions);
  await expect(page.getByTestId('response-attempts')).toHaveText(String(completedRounds * 6));
  for (const subject of ['Science', 'Social Studies', 'Literacy']) {
    const responses = committed.responses.filter((r: any) => r.subject === subject);
    const correct = responses.filter((r: any) => r.correct).length;
    const tile = page.locator('.assessment-subjects article').filter({ has: page.getByRole('heading', { name: subject, exact: true }) });
    await expect(tile).toContainText(`${Number((correct / responses.length * 100).toFixed(1))}% (${correct}/${responses.length})`);
  }
  await fits(page, '.assessment-view, .assessment-report-actions button');
  if (completedRounds === 17) await page.screenshot({ path: 'test-results/team-session-report-real.png' });
});

test('Twelve-team layout handles all visuals, printed-letter tasks, and the longest text', async ({ page }) => {
  await setup(page, 'K', 12);
  const longestPrompt = [...pack].sort((a, b) => b.question.length - a.question.length)[0];
  const longestChoice = [...pack].sort((a, b) => Math.max(...b.choices.map(c => c.length)) - Math.max(...a.choices.map(c => c.length)))[0];
  const cases = [...new Map([...pack.filter(q => ('visual' in q && q.visual) || ('delivery' in q && q.delivery === 'look-at-print')), longestPrompt, longestChoice].map(q => [q.id, q])).values()];
  for (const q of cases) {
    await page.evaluate(async ({ key, id, grade }) => {
      // @ts-expect-error Vite serves the production game adapter directly.
      const e = await import('/src/games/four-corners/engine.ts');
      const ids = [id, ...e.eligible(grade, 'Mixed Academic').map((q: any) => q.id).filter((q: string) => q !== id)];
      localStorage.setItem(key, JSON.stringify(e.beginGame({ ...e.freshState(), grade, teamCount: 12 }, ids, crypto.randomUUID(), new Date().toISOString())));
    }, { key, id: q.id, grade: q.grade });
    await page.reload(); await fits(page);
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    await page.getByRole('button', { name: 'Team 12', exact: true }).click();
    await fits(page);
  }
});

test('Six color defaults and accents preserve IDs across saved games, assessment and history', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  const initial = await state(page);
  expect(initial.session.teams.map((t: any) => t.name)).toEqual(colorNames);
  expect(initial.session.teams.map((t: any) => t.id)).toEqual([1, 2, 3, 4, 5, 6].map(i => `team-${i}`));
  expect(initial.session.teams.map((t: any) => t.accent)).toEqual(['#fb923c', '#c084fc', '#4ade80', '#facc15', '#f87171', '#60a5fa']);
  await expect(page.locator('.fc-scoreboard .assessment-team-name')).toHaveText(colorNames);
  const accents = page.locator('.fc-scoreboard .assessment-team-accent');
  await expect(accents).toHaveCount(6);
  await expect(accents.first()).toHaveCSS('background-color', 'rgb(251, 146, 60)');
  await expect(accents.last()).toHaveCSS('background-color', 'rgb(96, 165, 250)');
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await expect(page.locator('.fc-team-buttons .assessment-team-name')).toHaveText(colorNames);
  await page.getByRole('button', { name: 'Orange', exact: true }).click();
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  const committed = await state(page);
  // Simulate the previous release's generic six-team roster, preserving its responses and IDs.
  const old = { ...committed, session: { ...committed.session, teams: committed.session.teams.map((t: any, i: number) => ({ id: t.id, name: `Team ${i + 1}` })) } };
  const history = { version: 1, sessions: [{ ...old.session, id: 'older-report', endedAt: old.session.responses.at(-1).answeredAt }] };
  await page.evaluate(({ key, historyKey, old, history }) => {
    localStorage.setItem(key, JSON.stringify(old)); localStorage.setItem(historyKey, JSON.stringify(history));
  }, { key, historyKey, old, history });
  await page.reload();
  await expect(page.getByTestId('score-team-1')).toHaveText('Orange 1');
  expect((await state(page)).session.responses).toEqual(committed.session.responses);
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expect(page.locator('.assessment-scoreboard .assessment-team-name')).toHaveText(colorNames);
  await page.getByRole('button', { name: 'Team Performance', exact: true }).click();
  await expect(page.locator('.assessment-team-grid .assessment-team-name')).toHaveText(colorNames);
  await expect(page.locator('.assessment-team-grid .assessment-team-accent')).toHaveCount(6);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await end(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.assessment-scoreboard .assessment-team-name')).toHaveText(colorNames);
  await page.getByRole('button', { name: 'Change Setup', exact: true }).click();
  await page.getByRole('button', { name: 'Session History', exact: true }).click();
  await page.locator('.assessment-history-list button').last().click();
  await expect(page.locator('.assessment-scoreboard .assessment-team-name')).toHaveText(colorNames);
  await expect(page.locator('.assessment-scoreboard .assessment-team-accent')).toHaveCount(6);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions.find((s: any) => s.id === 'older-report'), historyKey)).toEqual(history.sessions[0]);
});
