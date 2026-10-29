import { test, expect, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { regions, states } from '../src/games/state-lingo-bingo/engine';

// The signed-in fixture server; the key uses the same capitals the game checks answers against.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Answer key: sign in returns to the key; 50 states A–Z, search jumps, region chips filter, phone sized', async ({ page }) => {
  await page.goto('/games/state-lingo-bingo/answer-key');
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.getByLabel('Email address', { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).toHaveURL(/\/games\/state-lingo-bingo\/answer-key$/);
  await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible();
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
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/signin-${name}.png` });
async function keyOpens(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${KEY}$`));
  await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible();
  await expect(page.locator('.slb-key-list li')).toHaveCount(50);
}
/** Reopening the phone's browser later: only cookies that outlive the browser session come back. */
async function reopen(browser: Browser, page: Page) {
  const kept = (await page.context().cookies()).filter(c => c.expires > Date.now() / 1000 + 300 * 24 * 3600);
  const later = await browser.newContext(phone); await later.addCookies(kept);
  return later.newPage();
}

test('Phone, signed out: key URL → sign in with Google → lands on the key; it opens straight away next time', async ({ browser }) => {
  const context = await browser.newContext(phone), page = await context.newPage();
  await page.goto(KEY);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fgames%2Fstate-lingo-bingo%2Fanswer-key$/);
  await shot(page, 'google-1-sign-in');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('DEVELOPMENT FIXTURE · simulated Google sign-in')).toBeVisible();
  await page.getByLabel('Email').fill(`${randomUUID()}@example.test`);
  await shot(page, 'google-2-account');
  await page.getByRole('button', { name: 'Continue' }).click();
  await keyOpens(page);
  await shot(page, 'google-3-key');
  // The return-address cookie is used once and cleared.
  expect((await context.cookies()).some(c => c.name === 'classthread-next' && c.value)).toBe(false);
  const again = await reopen(browser, page);
  await again.goto(KEY);
  await keyOpens(again);
  await shot(again, 'google-4-next-time');
  await again.context().close(); await context.close();
});

test('Phone, signed out: key URL → sign in with an email code → lands on the key; it opens straight away next time', async ({ browser }) => {
  const context = await browser.newContext(phone), page = await context.newPage();
  await page.goto(KEY);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.getByLabel('Email address', { exact: true }).fill(`${randomUUID()}@example.test`);
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Email code', { exact: true }).fill('123456');
  await shot(page, 'email-1-code');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await keyOpens(page);
  await shot(page, 'email-2-key');
  const again = await reopen(browser, page);
  await again.goto(KEY);
  await keyOpens(again);
  // A second way in: My Classroom links to the key.
  await again.goto('/classroom');
  await again.getByRole('link', { name: 'Answer key · State Lingo Bingo' }).click();
  await keyOpens(again);
  await again.context().close(); await context.close();
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
