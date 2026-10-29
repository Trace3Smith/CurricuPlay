import { test, expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { regions, states } from '../src/games/state-lingo-bingo/engine';

// The fixture server (sign-in works there); the key uses the same capitals the game checks answers against.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Answer key opens signed out and asks search engines not to list it; 50 states A–Z, search jumps, region chips filter, phone sized', async ({ page }) => {
  await page.goto('/games/state-lingo-bingo/answer-key');
  await expect(page).toHaveURL(/\/games\/state-lingo-bingo\/answer-key$/);
  await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(JSON.parse(readFileSync('vercel.json', 'utf8')).headers).toContainEqual({ source: '/games/state-lingo-bingo/answer-key', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] });
  const rows = page.locator('.slb-key-list li');
  await expect(rows).toHaveCount(50);
  const sorted = [...states].sort((a, b) => a.name.localeCompare(b.name));
  expect(await rows.locator('.slb-key-state').allTextContents()).toEqual(sorted.map(s => s.name));
  expect(await rows.locator('.slb-key-capital').allTextContents()).toEqual(sorted.map(s => s.capital));
  // Big, phone-width rows with no sideways scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await rows.first().locator('.slb-key-capital').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(28);
  expect((await page.getByLabel('Find a state').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Typing "wy" jumps to Wyoming and shows it below the search bar.
  await page.getByLabel('Find a state').fill('wy');
  const wyoming = page.getByTestId('key-WY');
  await expect(wyoming).toHaveClass(/slb-key-found/);
  await expect(wyoming).toBeInViewport();
  await page.waitForTimeout(600);
  const top = await page.locator('.slb-key-top').evaluate(e => e.getBoundingClientRect().bottom);
  expect((await wyoming.boundingBox())!.y).toBeGreaterThanOrEqual(top - 1);
  await page.getByLabel('Find a state').fill('zz');
  await expect(page.getByRole('status')).toHaveText('No state matches “zz”.');
  await page.getByLabel('Find a state').fill('');
  // Region chips match the game's regions and filter the list.
  await expect(page.getByRole('group', { name: 'Regions' }).getByRole('button')).toHaveText(['All 50', ...regions]);
  await page.getByRole('button', { name: 'Northeast' }).click();
  await expect(rows).toHaveCount(states.filter(s => s.region === 'Northeast').length);
  await page.getByRole('button', { name: 'West', exact: true }).click();
  await expect(rows).toHaveCount(states.filter(s => s.region === 'Northeast' || s.region === 'West').length);
  await page.getByRole('button', { name: 'All 50' }).click();
  await expect(rows).toHaveCount(50);
  await page.screenshot({ path: 'test-results/slb-answer-key-phone.png' });
});

const KEY = '/games/state-lingo-bingo/answer-key';
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: 'http://127.0.0.1:5174' };
/** Reopening the phone's browser later: only cookies that outlive the browser session come back. */
async function reopen(browser: Browser, page: Page) {
  const kept = (await page.context().cookies()).filter(c => c.expires > Date.now() / 1000 + 300 * 24 * 3600);
  const later = await browser.newContext(phone); await later.addCookies(kept);
  return later.newPage();
}

// Kept for when hosted sign-in is set up: sign-in returns to the page that asked for it, by Google or email, and lasts.
test('Sign-in with Google returns to the page that asked for it and stays signed in', async ({ browser }) => {
  const context = await browser.newContext(phone), page = await context.newPage();
  await page.goto('/manage');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto(`/sign-in?next=${encodeURIComponent('/manage/work')}`);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('DEVELOPMENT FIXTURE · simulated Google sign-in')).toBeVisible();
  await page.getByLabel('Email').fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5174\/manage\/work$/);
  expect((await context.cookies()).some(c => c.name === 'classthread-next' && c.value)).toBe(false); // used once, cleared
  const again = await reopen(browser, page);
  await again.goto('/manage/work');
  await expect(again).toHaveURL(/\/manage\/work$/);
  await again.context().close(); await context.close();
});

test('Sign-in with an email code returns to the page that asked; My Classroom has an Answer key button', async ({ browser }) => {
  const context = await browser.newContext(phone), page = await context.newPage();
  await page.goto(`/sign-in?next=${encodeURIComponent('/manage/work')}`);
  await page.getByLabel('Email address', { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5174\/manage\/work$/);
  await page.goto('/classroom');
  await page.getByRole('link', { name: 'Answer key · State Lingo Bingo' }).click();
  await expect(page).toHaveURL(new RegExp(`${KEY}$`));
  await expect(page.locator('.slb-key-list li')).toHaveCount(50);
  await page.screenshot({ path: 'test-results/classroom-to-key.png' });
  await context.close();
});

test('Sign-in never returns to another site or the API, by email or Google', async ({ browser }) => {
  const context = await browser.newContext(phone), page = await context.newPage();
  for (const bad of ['//evil.example', 'https://evil.example/x', '/api/foundation', '/\\evil.example']) {
    expect((await page.request.post('/api/auth/google', { headers: { Origin: 'http://127.0.0.1:5174' }, data: { next: bad } })).status(), bad).toBe(400);
  }
  await page.goto(`/sign-in?next=${encodeURIComponent('//evil.example')}`);
  await page.getByLabel('Email address', { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5174\/classroom$/);
  // A failed Google return keeps the page to come back to.
  const failed = await page.request.get(`/api/auth/callback?code=bad`, { headers: { Cookie: `classthread-next=${encodeURIComponent(KEY)}` }, maxRedirects: 0 });
  expect(failed.headers().location).toBe(`/sign-in?error=callback&next=${encodeURIComponent(KEY)}`);
  await context.close();
});

/** The sticky header is solid and full width: nothing from the list shows inside it, and its divider is below the count. */
async function headerCovers(page: Page, label: string) {
  const r = await page.evaluate(() => {
    const top = document.querySelector('.slb-key-top')!, box = top.getBoundingClientRect(), count = document.querySelector('.slb-key-status')!.getBoundingClientRect();
    const chips = document.querySelector('.slb-key-chips')!.getBoundingClientRect(), search = document.querySelector('.slb-key input')!.getBoundingClientRect();
    const leaks: string[] = [];
    for (let y = box.top + 1; y < box.bottom - 2; y += 4) for (let x = 2; x < innerWidth - 2; x += 12) {
      const el = document.elementFromPoint(x, y); if (el && !top.contains(el)) leaks.push(`${x},${y}:${el.className}`);
    }
    return { top: box.top, left: box.left, width: box.width, bottom: box.bottom, inner: innerWidth, belowCount: count.bottom <= box.bottom - 1, belowChips: chips.bottom <= box.bottom - 1, belowSearch: search.bottom <= box.bottom - 1, leaks: leaks.slice(0, 3), bg: getComputedStyle(top).backgroundColor };
  });
  expect(r.leaks, label).toEqual([]);
  expect([r.top, r.left, r.width], label).toEqual([0, 0, r.inner]);
  expect([r.belowSearch, r.belowChips, r.belowCount], label).toEqual([true, true, true]);
  expect(r.bg, label).toBe('rgb(252, 253, 255)');
}
for (const [width, height] of [[390, 844], [390, 667], [1024, 768]] as const) {
  test(`Answer key header covers the list at ${width}×${height}: top, middle, bottom, and searching "wy"`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' }); // jumps land instantly, so positions are final
    await page.goto('/games/state-lingo-bingo/answer-key');
    await expect(page.locator('.slb-key-list li')).toHaveCount(50);
    await headerCovers(page, 'top');
    await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await headerCovers(page, 'middle');
    if (width === 390 && height === 844) await page.screenshot({ path: 'test-results/key-middle.png' });
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await headerCovers(page, 'bottom');
    if (width === 390 && height === 844) await page.screenshot({ path: 'test-results/key-bottom.png' });
    await page.getByLabel('Find a state').fill('wy');
    await page.waitForTimeout(700);
    await headerCovers(page, 'searching wy');
    const wy = await page.getByTestId('key-WY').boundingBox(), bottom = await page.locator('.slb-key-top').evaluate(e => e.getBoundingClientRect().bottom);
    expect(wy!.y).toBeGreaterThanOrEqual(bottom); // Wyoming fully below the header, not under it
    expect(wy!.y + wy!.height).toBeLessThanOrEqual(height);
    if (width === 390 && height === 844) await page.screenshot({ path: 'test-results/key-wy.png' });
    await page.getByLabel('Find a state').fill('al');
    await page.waitForTimeout(700);
    expect((await page.getByTestId('key-AL').boundingBox())!.y).toBeGreaterThanOrEqual(await page.locator('.slb-key-top').evaluate(e => e.getBoundingClientRect().bottom));
  });
}
