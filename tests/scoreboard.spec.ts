import { test, expect } from '@playwright/test';
import { addPoints, fitGrid, freshState, leaders, loadState, MAX_TEAMS, recolor, rename, resetScores, SCOREBOARD_KEY, setCount, textOn, undo } from '../src/games/scoreboard/engine';

const memory = (value: string | null) => ({ getItem: () => value });

test('Scoreboard engine: points, floor at zero, undo and reset', () => {
  let s = freshState();
  expect(s.count).toBe(4);
  s = addPoints(s, 0, 3);
  s = addPoints(s, 1, 1);
  expect(s.teams.slice(0, 2).map(t => t.score)).toEqual([3, 1]);
  const before = s;
  expect(addPoints(s, 1, -5).teams[1].score).toBe(0);
  expect(addPoints(addPoints(s, 1, -5), 1, -1).history.length).toBe(s.history.length + 1);
  expect(addPoints(s, 9, 1)).toBe(s); // hidden team can't be scored
  s = resetScores(s);
  expect(s.teams.every(t => t.score === 0)).toBe(true);
  s = undo(s);
  expect(s.teams.map(t => t.score)).toEqual(before.teams.map(t => t.score));
  s = undo(undo(s));
  expect(s.teams.every(t => t.score === 0)).toBe(true);
  expect(undo(s)).toBe(s);
});

test('Scoreboard engine: 2–15 teams, hidden scores kept, names and colors', () => {
  let s = addPoints(setCount(freshState(), 6), 5, 4);
  s = setCount(s, 2);
  expect(s.count).toBe(2);
  expect(setCount(s, 1).count).toBe(2);
  expect(setCount(s, 40).count).toBe(MAX_TEAMS);
  expect(setCount(s, 6).teams[5].score).toBe(4);
  s = recolor(s, 0, 5);
  expect(s.teams[0].name).toBe('Blue'); // default name follows the color
  s = rename(s, 0, 'The Sharks are awesome!!');
  expect(s.teams[0].name).toBe('The Sharks are a');
  expect(recolor(s, 0, 2).teams[0].name).toBe('The Sharks are a');
  expect(recolor(s, 0, 99)).toBe(s);
});

test('Scoreboard engine: leader only when someone is ahead', () => {
  let s = freshState();
  expect(leaders(s)).toEqual([]);
  s = addPoints(s, 2, 2);
  expect(leaders(s)).toEqual([2]);
  s = addPoints(s, 0, 2);
  expect(leaders(s)).toEqual([0, 2]);
  s = addPoints(addPoints(s, 1, 2), 3, 2);
  expect(leaders(s)).toEqual([]);
});

test('Scoreboard engine: layout, contrast and save validation', () => {
  expect(fitGrid(4, 1800, 800, 20).columns).toBe(2);
  expect(fitGrid(15, 1800, 800, 12).columns).toBe(5);
  expect(fitGrid(2, 400, 700, 20).columns).toBe(1);
  expect(textOn('#facc15')).toBe('#0B1F44');
  expect(textOn('#111827')).toBe('#FFFFFF');
  expect(textOn('#c084fc')).toBe('#0B1F44');
  const saved = JSON.stringify(addPoints(freshState(), 0, 2));
  expect(loadState(memory(saved)).teams[0].score).toBe(2);
  for (const bad of [null, '{corrupt', '{"version":2}', JSON.stringify({ ...freshState(), count: 20 }), JSON.stringify({ ...freshState(), teams: [] })]) expect(loadState(memory(bad))).toEqual(freshState());
  expect(loadState({ getItem: () => { throw new Error('blocked'); } })).toEqual(freshState());
});

test('Scoreboard: opens from the Games hub, keeps score through a refresh, and resets with a confirm', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(key => localStorage.removeItem(key), SCOREBOARD_KEY);
  await page.getByTestId('open-scoreboard').click();
  await expect(page).toHaveURL(/\/games\/scoreboard$/);
  await expect(page.locator('.sb-tile')).toHaveCount(4);
  await page.getByRole('button', { name: 'Add 1 to Orange' }).click();
  await page.getByRole('button', { name: 'Add 1 to Orange' }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Add 3 to Green' }).click();
  await expect(page.getByTestId('sb-score-3')).toHaveText('3');
  await expect(page.getByTestId('sb-team-3')).toHaveClass(/sb-lead/);
  await expect(page.getByTestId('sb-team-3')).toContainText('LEADS');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('sb-score-3')).toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('sb-score-1')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Add 3 to Orange' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Keep Scores' }).click();
  await expect(page.getByTestId('sb-score-1')).toHaveText('2');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Reset Scores' }).click();
  await expect(page.getByTestId('sb-score-1')).toHaveText('0');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('sb-score-1')).toHaveText('2');
});

test('Scoreboard: teams panel changes count, names and colors', async ({ page }) => {
  await page.goto('/games/scoreboard');
  await page.evaluate(key => localStorage.removeItem(key), SCOREBOARD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Teams (4)' }).click();
  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'More teams' }).click();
  await expect(page.getByTestId('sb-count')).toHaveText('15');
  await expect(page.getByRole('button', { name: 'More teams' })).toBeDisabled();
  await page.getByLabel('Name for team 1', { exact: true }).fill('Sharks');
  await page.getByLabel('Color for team 2', { exact: true }).selectOption({ label: 'Lime' });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.sb-tile')).toHaveCount(15);
  await expect(page.getByTestId('sb-team-1')).toContainText('Sharks');
  await expect(page.getByTestId('sb-team-2')).toContainText('Lime');
});

for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720], [390, 844]]) {
  test(`Scoreboard fits ${width}×${height} with 2, 4 and 15 teams and every control reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const count of [2, 4, 15]) {
      await page.goto('/games/scoreboard');
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SCOREBOARD_KEY, JSON.stringify(setCount(freshState(), count))]);
      await page.reload();
      await expect(page.locator('.sb-tile')).toHaveCount(count);
      // Poll: tiles are re-measured once fonts load and the header settles.
      await expect.poll(() => page.evaluate(() => {
        const vw = innerWidth, vh = innerHeight;
        // A phone may scroll the board (DESIGN.md), so only the classroom screen sizes must fit without scrolling.
        const scrolls = document.querySelector('.sb-board')!.classList.contains('sb-scroll');
        if (scrolls && vw >= 1280) return { out: -1, small: 0, clipped: 0, scrollX: false };
        const out = [...document.querySelectorAll<HTMLElement>(scrolls ? '.sb-controls button' : '.sb-tile, .sb-buttons button, .sb-controls button')].filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1; });
        const small = [...document.querySelectorAll<HTMLElement>('.sb-buttons button, .sb-controls button')].filter(el => el.getBoundingClientRect().height < 44);
        const clipped = [...document.querySelectorAll<HTMLElement>('.sb-score')].filter(el => el.scrollHeight > el.clientHeight + 2);
        return { out: out.length, small: small.length, clipped: clipped.length, scrollX: document.documentElement.scrollWidth > vw };
      }), { message: `${count} teams` }).toEqual({ out: 0, small: 0, clipped: 0, scrollX: false });
    }
  });
}
