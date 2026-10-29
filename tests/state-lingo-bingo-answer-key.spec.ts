import { test, expect } from '@playwright/test';
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
