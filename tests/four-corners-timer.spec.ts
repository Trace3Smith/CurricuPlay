import { test, expect, type Page } from '@playwright/test';
import { secondsRemaining } from '../src/games/four-corners/movementTimer';
const key = 'curricuplay.four-corners.v1';
const timerKey = 'curricuplay.four-corners.timer.v1';
const countdown = (page: Page) => page.getByRole('timer', { name: 'Movement countdown' });
async function setup(page: Page, seconds = '10') {
  await page.clock.install({ time: new Date('2026-09-18T09:00:00') });
  await page.clock.pauseAt(new Date('2026-09-18T10:00:00'));
  await page.goto('/#four-corners');
  await expect(page.getByLabel('Movement timer duration')).toHaveValue('10');
  await expect(page.getByLabel('Movement timer duration').locator('option')).toHaveText(['Off', '10 seconds', '15 seconds', '20 seconds']);
  await page.getByLabel('Movement timer duration').selectOption(seconds);
}
const state = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.fc-game h1, .fc-choice, .fc-timer-count, .fc-timer-buttons button, .fc-controls button').evaluateAll(nodes => nodes.every(e => {
    const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && e.scrollHeight <= e.clientHeight + 1;
  }))).toBe(true);
}
test('Countdown uses a monotonic deadline, rounds up, and never becomes negative', () => {
  expect(secondsRemaining(10000, 0)).toBe(10);
  expect(secondsRemaining(10000, 999)).toBe(10);
  expect(secondsRemaining(10000, 1000)).toBe(9);
  expect(secondsRemaining(10000, 9999)).toBe(1);
  expect(secondsRemaining(10000, 10000)).toBe(0);
  expect(secondsRemaining(10000, 60000)).toBe(0);
});
test('Manual start, TIME!, and Next reset never reveal or collect responses automatically', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  const initial = await state(page);
  await page.clock.runFor(30000); await expect(countdown(page)).toHaveText('10');
  await page.getByRole('button', { name: 'Start 10 Seconds', exact: true }).click();
  await page.clock.runFor(7000); await expect(countdown(page)).toHaveText('3'); await fits(page);
  await page.screenshot({ path: 'test-results/four-corners-timer-countdown.png' });
  await page.clock.runFor(1000); await expect(countdown(page)).toHaveText('2');
  await page.clock.runFor(1000); await expect(countdown(page)).toHaveText('1');
  await page.clock.runFor(1000); await expect(countdown(page)).toHaveText('TIME!'); await fits(page);
  await page.screenshot({ path: 'test-results/four-corners-timer-time.png' });
  expect(await state(page)).toEqual(initial);
  await expect(page.locator('.fc-correct')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reveal Answer', exact: true })).toBeVisible();
  await page.clock.runFor(30000); expect((await state(page)).session.responses).toEqual([]);
  await page.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
  await expect(countdown(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Orange', exact: true }).click();
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  await expect(countdown(page)).toHaveText('10');
  await expect(page.getByRole('button', { name: 'Start 10 Seconds', exact: true })).toBeVisible();
  expect((await state(page)).session.responses).toHaveLength(6);
  await page.clock.runFor(30000); await expect(countdown(page)).toHaveText('10');
});
for (const duration of [15, 20]) test(`${duration} seconds persists, restarts, cancels, and stops on manual reveal`, async ({ page }) => {
  await setup(page, String(duration)); await page.reload();
  await expect(page.getByLabel('Movement timer duration')).toHaveValue(String(duration));
  await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: `Start ${duration} Seconds`, exact: true }).click();
  await page.clock.runFor(5000); await expect(countdown(page)).toHaveText(String(duration - 5));
  await page.getByRole('button', { name: `Restart ${duration} Seconds`, exact: true }).click();
  await expect(countdown(page)).toHaveText(String(duration));
  await page.clock.runFor(2000); await expect(countdown(page)).toHaveText(String(duration - 2));
  await page.getByRole('button', { name: 'Cancel Timer', exact: true }).click();
  await page.clock.runFor(30000); await expect(countdown(page)).toHaveText(String(duration));
  await page.getByRole('button', { name: `Start ${duration} Seconds`, exact: true }).click();
  await page.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
  await page.clock.runFor(30000); await expect(countdown(page)).toHaveCount(0);
  const s = await state(page); expect(s.revealed).toBe(true); expect(s.session.responses).toEqual([]);
});
test('A running timer resets on refresh; expired state restores TIME without changing the round', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: 'Start 10 Seconds', exact: true }).click();
  await page.clock.runFor(4000); await expect(countdown(page)).toHaveText('6');
  const initial = await state(page);
  await page.reload(); await expect(countdown(page)).toHaveText('10');
  await expect(page.getByText('Timer reset after returning. Start when ready.')).toBeVisible();
  await page.clock.runFor(20000); await expect(countdown(page)).toHaveText('10');
  expect(await state(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Start 10 Seconds', exact: true }).click();
  await page.clock.runFor(10000); await expect(countdown(page)).toHaveText('TIME!');
  await page.reload(); await expect(countdown(page)).toHaveText('TIME!'); expect(await state(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Restart 10 Seconds', exact: true }).click();
  await expect(countdown(page)).toHaveText('10');
  await page.getByRole('button', { name: 'Cancel Timer', exact: true }).click();
  await page.reload(); await expect(countdown(page)).toHaveText('10');
});
test('Off and Classic have no timer; corrupted timer storage cannot destroy game recovery', async ({ page }) => {
  await setup(page, '0'); await page.reload(); await expect(page.getByLabel('Movement timer duration')).toHaveValue('0');
  await page.getByRole('button', { name: /^Start Game/ }).click(); await expect(countdown(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('button', { name: 'Classic Mode', exact: true }).click();
  await expect(page.getByLabel('Movement timer duration')).toHaveCount(0);
  await page.getByRole('button', { name: /^Start Game/ }).click(); await expect(countdown(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change Grade', exact: true }).click();
  await page.getByRole('button', { name: 'Team Mode · Recommended for PE', exact: true }).click();
  await page.getByLabel('Movement timer duration').selectOption('10');
  await page.getByRole('button', { name: /^Start Game/ }).click(); const initial = await state(page);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), timerKey);
  await page.reload(); await expect(countdown(page)).toHaveText('10'); expect(await state(page)).toEqual(initial);
});
test('An ended or reset game never inherits the previous round countdown', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: /^Start Game/ }).click();
  await page.getByRole('button', { name: 'Start 10 Seconds', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset Game', exact: true }).click();
  await expect(countdown(page)).toHaveText('10'); await page.clock.runFor(15000); await expect(countdown(page)).toHaveText('10');
  await page.getByRole('button', { name: 'Start 10 Seconds', exact: true }).click();
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End Game', exact: true }).click();
  await page.clock.runFor(15000); await expect(page.getByTestId('response-attempts')).toHaveText('0');
  await page.getByRole('button', { name: 'Play Again', exact: true }).click();
  await expect(countdown(page)).toHaveText('10'); await page.clock.runFor(15000); await expect(countdown(page)).toHaveText('10');
});
