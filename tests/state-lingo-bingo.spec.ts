import { test, expect, type Page } from '@playwright/test';
import { beginGame, boardLayout, freshSettings, judge, setTarget, stateByCode, states, type BingoState, type Settings } from '../src/games/state-lingo-bingo/engine';
import { BINGO_ACTIVE_KEY } from '../src/games/state-lingo-bingo/keys';

const key = BINGO_ACTIVE_KEY;
const historyKey = 'curricuplay.sessions.v1';
const sizes = [[1920, 1080], [1536, 864], [1280, 720]] as const;
function seeded(seed = 7) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
async function saved(page: Page): Promise<BingoState> { return page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key); }
/** Build a game in Node and load it as this browser's active save. */
async function inject(page: Page, patch: Partial<Settings>, moves = true): Promise<BingoState> {
  const start = Date.now() - 60_000, at = (s: number) => new Date(start + s * 1000).toISOString();
  let s = beginGame({ ...freshSettings('5'), ...patch }, 'injected', at(0), seeded())!;
  if (moves) {
    const card = s.cards!['team-1'];
    [0, 1].forEach(i => { s = judge(setTarget(s, 'team-1', card[i]!, at(i * 2 + 1)), 'team-1', 'correct', at(i * 2 + 2)); });
    s = setTarget(s, 'team-1', card[2]!, at(10));
    s = setTarget(s, 'team-2', s.cards!['team-2'][3]!, at(11));
  }
  await page.goto('/games');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(s)]);
  await page.goto('/games/state-lingo-bingo');
  await expect(page.locator('.slb-team')).toHaveCount(s.teams!.length);
  return s;
}
const squareName = (s: BingoState, team: string, i: number) => stateByCode.get(s.cards![team][i]!)!.name;
async function fits(page: Page) {
  expect(await page.evaluate(() => ({ h: document.documentElement.scrollHeight <= innerHeight, w: document.documentElement.scrollWidth <= innerWidth }))).toEqual({ h: true, w: true });
  const over = await page.locator('.slb-team, .slb-square, .slb-square .slb-name, .slb-team-head, .slb-target, .slb-controls button, .slb-fitness li, .header-actions button').evaluateAll(nodes => nodes.filter(n => {
    const r = n.getBoundingClientRect();
    return r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5 || n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1;
  }).map(n => `${n.className}: ${n.textContent?.slice(0, 30)}`));
  expect(over).toEqual([]);
  // Every line of every square's name stays inside the square (a clipped name is unreadable).
  const clipped = await page.locator('.slb-square .slb-name').evaluateAll(nodes => nodes.filter(n => {
    const sq = n.parentElement!.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(n);
    return [...range.getClientRects()].some(l => l.left < sq.left - .5 || l.right > sq.right + .5 || l.top < sq.top - .5 || l.bottom > sq.bottom + .5);
  }).map(n => n.textContent));
  expect(clipped).toEqual([]);
}

test('Full play-through: setup with custom names, targets, wrong tile, bingo, undo, refresh recovery, end and records', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/games/state-lingo-bingo');
  await expect(page.getByTestId('general-practice')).toHaveText('General Practice · Not district-paced · Available on any date');
  await page.getByRole('button', { name: '3rd Grade' }).click();
  await expect(page.getByRole('button', { name: '4×4' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '4th Grade' }).click();
  await expect(page.getByRole('button', { name: '5×5 · free center' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '3rd Grade' }).click();
  await page.getByLabel('Number of teams').selectOption('2');
  // Region filter warning.
  for (const r of ['Midwest', 'South', 'West']) await page.getByRole('button', { name: new RegExp(`^${r}`) }).click();
  await expect(page.getByTestId('setup-errors')).toContainText('A 4×4 card needs at least 16 states. The selected regions have 9.');
  await expect(page.getByRole('button', { name: /Start Game/ })).toBeDisabled();
  await page.getByRole('button', { name: /^South/ }).click();
  await expect(page.getByTestId('region-count')).toHaveText('25 states selected · a 4×4 card needs 16.');
  // Names: length limit and duplicates.
  await page.getByLabel('Name for Team 1').fill('Rockets');
  await page.getByLabel('Name for Team 2').fill('A much too long team name');
  await expect(page.getByLabel('Name for Team 2')).toHaveValue('A much too long ');
  await page.getByLabel('Name for Team 2').fill('rockets');
  await expect(page.getByTestId('setup-errors')).toContainText('Team 2: “rockets” is already used by another team.');
  await page.getByLabel('Name for Team 2').fill('Comets');
  await expect(page.getByTestId('setup-errors')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/slb-setup.png', fullPage: true });
  await page.getByRole('button', { name: /Start Game/ }).click();

  const s = await saved(page);
  expect(s.teams!.map(t => t.name)).toEqual(['Rockets', 'Comets']);
  expect(s.settings.regions).toEqual(['Northeast', 'South']);
  expect(Object.values(s.cards!).every(c => c.length === 16)).toBe(true);
  const sq = (i: number, team = 'team-1') => page.getByRole('button', { name: new RegExp(`^${team === 'team-1' ? 'Rockets' : 'Comets'}: ${squareName(s, team, i)}`) });
  await page.getByRole('button', { name: /Rockets/ }).first().click();
  await sq(0).click();
  await expect(page.getByTestId('target-popup')).toContainText(squareName(s, 'team-1', 0));
  await expect(page.getByTestId('target-team-1')).toContainText(squareName(s, 'team-1', 0));
  await page.getByRole('button', { name: '✗ Wrong tile' }).click();
  await expect(page.getByText('Wrong tile recorded for Rockets. Back to the pool!')).toBeVisible();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByTestId('peek-capital')).toHaveText(stateByCode.get(s.cards!['team-1'][0]!)!.capital);
  await page.getByRole('button', { name: '✓ Correct capital' }).click();
  await expect(page.getByTestId('peek-capital')).toHaveCount(0);
  await expect(page.getByTestId('points-team-1')).toHaveText('1');
  for (const i of [1, 2]) { await sq(i).click(); await page.getByRole('button', { name: '✓ Correct capital' }).click(); }
  await sq(3).click(); await page.getByRole('button', { name: '✓ Correct capital' }).click();
  await expect(page.locator('[data-testid=card-team-1] .slb-flash')).toHaveText('BINGO!');
  await expect(page.getByTestId('points-team-1')).toHaveText('9');
  await expect(page.getByTestId('card-team-1')).toContainText('1 bingo');
  // Undo the bingo tap: the square returns to being the target.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('points-team-1')).toHaveText('3');
  await expect(page.getByTestId('target-team-1')).toContainText(squareName(s, 'team-1', 3));
  await page.getByRole('button', { name: '✓ Correct capital' }).click();
  await expect(page.getByTestId('points-team-1')).toHaveText('9');
  // Play continues after a bingo; Comets get a wrong tile and a correct one.
  await page.getByRole('button', { name: /Comets/ }).first().click();
  await sq(0, 'team-2').click();
  await page.getByRole('button', { name: '✗ Wrong tile' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText(/Undid the last tap \(wrong tile\) for Comets/)).toBeVisible();
  await page.getByRole('button', { name: '✗ Wrong tile' }).click();
  await sq(5, 'team-2').click(); // change target before the tile returns
  await page.getByRole('button', { name: '✓ Correct capital' }).click();
  await expect(page.getByTestId('points-team-2')).toHaveText('1');
  await fits(page);
  await page.screenshot({ path: 'test-results/slb-play-1920.png' });

  // Refresh mid-game: everything comes back exactly, without End.
  const before = await page.evaluate(k => localStorage.getItem(k), key);
  await page.reload();
  await expect(page.getByTestId('points-team-1')).toHaveText('9');
  await expect(page.getByTestId('points-team-2')).toHaveText('1');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(before);
  // Leaving and coming back through the hub also resumes.
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const card = page.getByRole('button', { name: /STATE LINGO BINGO/ });
  await expect(card).toContainText('CONTINUE');
  await expect(card).toContainText('3rd Grade · 2 teams');
  await card.click();
  await expect(page.getByTestId('points-team-1')).toHaveText('9');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(before);
  // Live assessment, then End.
  await page.getByRole('button', { name: 'Assessment', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('State Lingo Bingo');
  await expect(page.getByTestId('response-attempts')).toHaveText('7');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Game over. Great digging!' })).toBeVisible();
  await expect(page.getByTestId('result-team-1').locator('td')).toHaveText(['Rockets', '9', '1', '—', '4', '1', '80%']);
  await expect(page.getByTestId('result-team-2').locator('td')).toHaveText(['Comets', '1', '0', '—', '1', '1', '50%']);
  const review = page.getByRole('region', { name: 'Review list' });
  await expect(review).toContainText(`${squareName(s, 'team-1', 0)} — ${stateByCode.get(s.cards!['team-1'][0]!)!.capital} · Rockets · wrong tile`);
  await expect(review).toContainText(`${squareName(s, 'team-2', 0)} — ${stateByCode.get(s.cards!['team-2'][0]!)!.capital} · Comets · wrong tile`);
  await page.screenshot({ path: 'test-results/slb-results.png', fullPage: true });
  const history = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), historyKey);
  expect(history.sessions).toHaveLength(1);
  expect(history.sessions[0]).toMatchObject({ gameType: 'state-lingo-bingo', grade: '3', mode: 'team', teams: [{ name: 'Rockets' }, { name: 'Comets' }] });
  expect(history.sessions[0].responses.map((r: any) => [r.teamId, r.correct, r.pointsAwarded])).toEqual([
    ['team-1', false, 0], ['team-1', true, 1], ['team-1', true, 1], ['team-1', true, 1], ['team-1', true, 6], ['team-2', false, 0], ['team-2', true, 1]]);
  // A finished game is no longer offered as Continue, and it shows in shared Session History.
  await page.getByRole('button', { name: 'Back to Games' }).click();
  await expect(page.getByRole('button', { name: /STATE LINGO BINGO/ })).toContainText('PLAY');
  await page.goto('/games/four-corners');
  await page.getByRole('button', { name: 'Session History' }).click();
  await expect(page.locator('.assessment-history-list button')).toContainText(['Grade 3 · State Lingo Bingo']);
  // New Game clears the active save and keeps the settings.
  await page.goto('/games/state-lingo-bingo');
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page.getByLabel('Name for Team 1')).toHaveValue('Rockets');
  expect((await saved(page)).screen).toBe('setup');
});

test('Board layout for every team count from 2 to 10 at 1920×1080, 1536×864 and 1280×720', async ({ page }) => {
  test.setTimeout(180_000);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (let count = 2; count <= 10; count++) {
      await inject(page, { teamCount: count, size: 5 });
      await fits(page);
      const boxes = await page.locator('.slb-team').evaluateAll(n => n.map(e => e.getBoundingClientRect().toJSON()));
      const [cols, rows] = boardLayout(count);
      const tops = [...new Set(boxes.map(b => Math.round(b.top)))];
      expect(tops, `${count} teams at ${width}`).toHaveLength(rows);
      expect(boxes.filter(b => Math.round(b.top) === tops[0])).toHaveLength(cols);
      // Equal sections, and a short last row is centered.
      expect(Math.max(...boxes.map(b => b.width)) - Math.min(...boxes.map(b => b.width))).toBeLessThan(2);
      const board = await page.locator('.slb-board').evaluate(e => e.getBoundingClientRect().toJSON());
      const last = boxes.filter(b => Math.round(b.top) === tops.at(-1));
      expect(Math.abs((last[0].left - board.left) - (board.right - last.at(-1)!.right))).toBeLessThan(2);
      if ([2, 5, 10].includes(count)) await page.screenshot({ path: `test-results/slb-layout-${count}-${width}.png` });
    }
  }
  // 4×4 cards for 3rd grade at the smallest size.
  await inject(page, { grade: '3', size: 4, teamCount: 10 });
  await fits(page);
});

test('Every state name fits its square at one size per card, with a compact empty target bar', async ({ page }) => {
  // 10 teams on 5×5 cards, rebuilt so all 50 states appear (the longest names on team 1).
  const start = Date.now() - 60_000;
  let s = beginGame({ ...freshSettings('5'), teamCount: 10 }, 'all-states', new Date(start).toISOString(), seeded())!;
  const codes = [...states].sort((a, b) => b.name.length - a.name.length).map(x => x.code);
  s.teams!.forEach((t, ti) => { s.cards![t.id] = s.cards![t.id].map((c, i) => c === null ? null : codes[(ti * 24 + (i > 12 ? i - 1 : i)) % 50]); });
  s = setTarget(s, 'team-1', s.cards!['team-1'][0]!, new Date(start + 1000).toISOString());
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/games');
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(s)]);
    await page.goto('/games/state-lingo-bingo');
    await expect(page.locator('.slb-card[style*="--card-font"]')).toHaveCount(10);
    await fits(page);
    const cards = await page.locator('.slb-card').evaluateAll(cards => cards.map(card => {
      const names = [...card.querySelectorAll<HTMLElement>('.slb-square:not(.slb-free) .slb-name')];
      return { base: parseFloat((card as HTMLElement).style.getPropertyValue('--card-font')),
        sizes: names.map(n => ({ long: n.classList.contains('slb-long'), size: parseFloat(getComputedStyle(n).fontSize) })) };
    }));
    const floor = height / 100;
    for (const card of cards) {
      expect(card.base).toBeGreaterThanOrEqual(floor - 0.01);
      for (const n of card.sizes) expect(n.size).toBeCloseTo(card.base * (n.long ? 0.9 : 1), 1);
    }
    expect(new Set(cards.flatMap(c => c.sizes.length))).toEqual(new Set([24]));
    const [empty, set] = await Promise.all(['target-team-2', 'target-team-1'].map(id => page.getByTestId(id).evaluate(e => e.getBoundingClientRect().height)));
    expect(empty).toBeLessThan(set / 2);
    if (width === 1920) await page.screenshot({ path: 'test-results/slb-all-states-1920.png' });
  }
});

test('Target pop-up never blocks controls and appears without animation under reduced motion', async ({ page }) => {
  for (const motion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    const s = await inject(page, { teamCount: 4 }, false);
    await page.getByRole('button', { name: /Team 1/ }).first().click();
    await page.getByRole('button', { name: new RegExp(`^Team 1: ${squareName(s, 'team-1', 0)}`) }).click();
    const popup = page.getByTestId('target-popup');
    await expect(popup).toBeVisible();
    expect(await popup.evaluate(e => getComputedStyle(e).animationName)).toBe(motion === 'reduce' ? 'none' : 'slb-pop');
    expect(await popup.evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
    // Controls still work while the pop-up is showing.
    await page.getByRole('button', { name: '✓ Correct capital' }).click();
    await expect(page.getByTestId('points-team-1')).toHaveText('1');
    await expect(popup).toHaveCount(0, { timeout: 5000 });
  }
});

test('Map-only modes hide names on the board but keep them for screen readers and the teacher', async ({ page }) => {
  for (const mode of ['outline', 'location'] as const) {
    const s = await inject(page, { teamCount: 3, squareMode: mode }, false);
    await expect(page.locator('.slb-square .slb-name')).toHaveCount(3); // only the FREE centers
    await expect(page.locator(mode === 'location' ? '.slb-square svg.slb-location' : '.slb-square svg.slb-solo')).toHaveCount(72);
    const name = squareName(s, 'team-1', 0);
    await page.getByRole('button', { name: /Team 1/ }).first().click();
    await page.getByRole('button', { name: new RegExp(`^Team 1: ${name}`) }).click();
    await expect(page.locator('.slb-controls')).toContainText('Target: shown on card');
    await expect(page.locator('.slb-board')).not.toContainText(name);
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.locator('.slb-controls')).toContainText(`Target: ${name} · Capital: ${stateByCode.get(s.cards!['team-1'][0]!)!.capital}`);
    await page.screenshot({ path: `test-results/slb-map-${mode}.png` });
  }
});

test('Phones can scroll, but every control stays reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const s = await inject(page, { teamCount: 8 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const name = squareName(s, 'team-8', 0);
  await page.getByRole('button', { name: /Team 8/ }).first().click();
  await page.getByRole('button', { name: new RegExp(`^Team 8: ${name}`) }).click();
  const controls = page.getByRole('region', { name: 'Teacher controls' });
  await expect(controls).toBeInViewport();
  await page.getByRole('button', { name: '✓ Correct capital' }).click();
  await expect(page.getByTestId('points-team-8')).toHaveText('1');
  for (const label of ['Undo', 'Assessment', 'End Game', 'Home', 'Full Screen']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/slb-phone.png', fullPage: true });
});

test('An unreadable save is left untouched until the teacher discards it', async ({ page }) => {
  await page.goto('/games');
  await page.evaluate(k => localStorage.setItem(k, '{"version":1,"screen":"play"'), key);
  await page.goto('/games/state-lingo-bingo');
  await expect(page.getByRole('alert')).toContainText('could not be read. It was left untouched');
  await expect(page.getByRole('button', { name: /Start Game/ })).toBeDisabled();
  await page.getByLabel('Number of teams').selectOption('4');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{"version":1,"screen":"play"');
  await page.goto('/games');
  await expect(page.getByRole('button', { name: /STATE LINGO BINGO/ })).toContainText('PLAY');
  await page.goto('/games/state-lingo-bingo');
  await page.getByRole('button', { name: 'Discard saved game' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Start Game/ })).toBeEnabled();
  expect((await saved(page)).screen).toBe('setup');
});

test('Games hub shows all four games without scrolling at each screen size', async ({ page }) => {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/games');
    await expect(page.locator('.game-card.live')).toHaveCount(4);
    expect(await page.locator('.game-card.live').evaluateAll(cards => cards.every(card => {
      const b = card.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && card.scrollHeight <= card.clientHeight + 1;
    }))).toBe(true);
    if (width === 1920) await page.screenshot({ path: 'test-results/slb-hub-1920.png' });
  }
});
