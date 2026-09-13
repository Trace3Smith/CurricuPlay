import { test, expect, type Page } from '@playwright/test';
// Synthetic software fixtures only. Not curriculum content and never included in src/data.
const grades = ['K', '1', '2', '3', '4', '5'];
const subjects = ['Literacy', 'Math', 'Science', 'Social Studies'];
const fixture = grades.flatMap(grade => subjects.flatMap(subject => [1, 2, 3].flatMap(difficulty => [0, 1, 2, 3].map(n => ({
  id: `${grade}-${subject}-${difficulty}-${n}`, grade, subject, difficulty, question: `TEST ONLY: ${grade} ${subject} ${difficulty} prompt ${n}?`, answer: `TEST ONLY: answer ${n}`,
  standard: 'TEST-ONLY', source: 'Synthetic software test fixture — not approved curriculum', weekIntroduced: '2026-09-07', reviewQuestion: true,
  choices: ['Test option one', 'Test option two', 'Test option three'],
})))));
async function inject(page: Page, questions = fixture) {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00'));
  await page.route('**/src/data/questions.json*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify(questions)}` }));
}
async function start(page: Page, grade = 'K') {
  await page.goto('/');
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await page.getByRole('button', { name: grade === 'K' ? 'Kindergarten' : `${grade}${grade === '1' ? 'st' : grade === '2' ? 'nd' : grade === '3' ? 'rd' : 'th'} Grade`, exact: true }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight })) ).toEqual({ x: false, y: false });
  expect(await page.evaluate(() => [...document.querySelectorAll('main button, main h1, .answer')].every(e => { const r=e.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }))).toBe(true);
}
for (const grade of grades) test(`Grade ${grade}: complete game, no repeats, reveal, refresh, reset and navigation`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await inject(page); await start(page, grade); await noOverflow(page);
  await expect(page.getByRole('button', { name: /opportunity/ })).toHaveCount(30);
  const used = new Set<string>();
  for (let i = 0; i < 30; i++) {
    await page.getByRole('button', { name: /opportunity/ }).filter({ hasText: /POINT/ }).first().click();
    const prompt = await page.locator('main h1').innerText(); expect(used.has(prompt)).toBe(false); used.add(prompt);
    await expect(page.getByText('CORRECT ANSWER', { exact: true })).toHaveCount(0);
    if (grade === 'K') await expect(page.getByText('TEACHER READS QUESTION ALOUD', { exact: true })).toBeVisible();
    if (grade === '1') await expect(page.getByText('TEACHER MAY READ QUESTION ALOUD', { exact: true })).toBeVisible();
    if (i === 0) { await noOverflow(page); await page.reload(); await expect(page.locator('main h1')).toHaveText(prompt); await expect(page.getByRole('button', { name: 'Reveal Answer' })).toBeVisible(); }
    await page.getByRole('button', { name: 'Reveal Answer' }).click();
    await expect(page.getByText('CORRECT ANSWER', { exact: true })).toBeVisible();
    if (i === 0) { await noOverflow(page); await page.reload(); await expect(page.getByText('CORRECT ANSWER', { exact: true })).toBeVisible(); }
    await page.getByRole('button', { name: 'Back to Board' }).click();
    await expect(page.getByRole('button', { name: /opportunity.*used/ })).toHaveCount(i + 1);
    for (const b of await page.getByRole('button', { name: /opportunity.*used/ }).all()) await expect(b).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('button', { name: 'Keep Playing' }).click();
  await expect(page.getByRole('button', { name: /opportunity.*used/ })).toHaveCount(30);
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Game' }).click();
  await expect(page.getByRole('button', { name: /opportunity.*used/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week’s content. Ready to play.' })).toBeVisible();
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page.getByText('Choose your challenge.')).toBeVisible();
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change Grade' }).click();
  await expect(page.getByText('Let’s get your class playing.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('Unmodified app clearly reports missing source content and prevents starting', async ({ page }) => {
  await inject(page, []); await page.goto('/'); await expect(page.getByText(/No approved local questions/)).toBeVisible(); await noOverflow(page);
  await page.screenshot({ path: 'test-results/home.png' });
  await page.getByRole('button', { name: /JEOPARDY/ }).click();
  for (const grade of ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade']) {
    await page.getByRole('button', { name: grade, exact: true }).click(); await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  }
});
test('Ranges, future exclusion, empty pools and exhausted overlapping Review pool', async ({ page }) => {
  const q = fixture[0];
  await inject(page, [{ ...q, id: 'old', weekIntroduced: '2026-08-17' }, { ...q, id: 'recent' }, { ...q, id: 'future', weekIntroduced: '2026-09-14' }]);
  await page.goto('/'); await page.getByRole('button', { name: /JEOPARDY/ }).click();
  await expect(page.getByText('1 approved questions available')).toBeVisible();
  await page.getByRole('button', { name: /EVERYTHING TAUGHT SO FAR/ }).click();
  await expect(page.getByText('2 approved questions available')).toBeVisible();
  await page.getByRole('button', { name: /RECENT CONTENT/ }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByRole('button', { name: /Math.*no questions available/ }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Literacy 1 point opportunity 1', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.getByRole('button', { name: 'Back to Board' }).click();
  await expect(page.getByRole('button', { name: /Review.*no questions available/ })).toHaveCount(6);
  await expect(page.getByText(/All available challenges completed/)).toBeVisible();
});
test('Engine random selection, filters, tracking and invalid-bank rejection', async ({ page }) => {
  await inject(page); await page.goto('/');
  const results = await page.evaluate(async (questions) => {
    // @ts-expect-error Vite serves TypeScript modules in browser
    const { createQuestionEngine, validateQuestions } = await import('/src/services/questionEngine.ts');
    const engine = createQuestionEngine(questions), filters = { grade: 'K', subject: 'Math', difficulty: 2, range: 'recent', asOf: '2026-09-13' };
    const choices = new Set(); for (let i = 0; i < 100; i++) choices.add(engine.getRandomQuestion(filters).id);
    const first = engine.getRandomQuestion(filters); engine.markQuestionUsed(first.id);
    const excluded = !engine.getQuestions(filters).some((q: { id: string }) => q.id === first.id);
    const used = engine.isQuestionUsed(first.id); engine.resetUsedQuestions();
    return { random: choices.size > 1, excluded, used, count: engine.getAvailableQuestionCount(filters), invalid: validateQuestions([questions[0], questions[0]]).questions.length };
  }, fixture);
  expect(results).toEqual({ random: true, excluded: true, used: true, count: 4, invalid: 0 });
});
test('Corrupt storage and storage unavailability fail gracefully', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('curricuplay.game.v1', '{broken'); });
  await page.goto('/'); await expect(page.locator('h1')).toContainText('Ready to play.');
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await page.reload(); await expect(page.getByRole('alert')).toContainText('Progress cannot be saved');
});
test('Board and question layout screenshots', async ({ page }) => {
  await inject(page); await start(page); await page.screenshot({ path: 'test-results/board.png' });
  await page.getByRole('button', { name: 'Math 2 points opportunity 2', exact: true }).click();
  await page.screenshot({ path: 'test-results/question.png' });
  await page.getByRole('button', { name: 'Reveal Answer' }).click(); await page.screenshot({ path: 'test-results/answer.png' });
});
