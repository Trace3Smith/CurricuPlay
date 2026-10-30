import { test, expect, type Page } from '@playwright/test';
import { ACTIVE_KEY } from '../src/games/spelling-bee/storage';
import { acceptedLabel, beginGame, clearMarks, commitResults, currentWord, isBeeState, letterChoices, nextWord, teachingLine, toggleTeam, type BeeState } from '../src/games/spelling-bee/engine';
import { validAlsoAccept, validateWords, type WordEntry } from '../src/games/spelling-bee/words';
import { selectCurriculum } from '../src/curriculum/eligibility';
import { curriculumBank } from '../src/games/spelling-bee/bank';

// Kindergarten first-letter photos. Rabbit accepts B ("bunny"), the case a class would actually meet.
const selection = { grade: 'K' as const, mode: 'current' as const, cutoff: '2026-10-23', priorGrade: false };
const now = '2026-10-23T15:00:00.000Z';
function game(alsoAccept?: WordEntry['alsoAccept']): BeeState {
  const words = selectCurriculum(curriculumBank, selection).map(w => w.word === 'rabbit' && alsoAccept ? { ...w, alsoAccept } : w);
  const s = beginGame(words, 'K', 'missing', 'also-accept', now, () => .5, { selection, reviewed: true, untilStop: false, choices: 0 })!;
  const rabbit = s.words.find(w => w.word === 'rabbit')!.id;
  return { ...s, flow: { ...s.flow!, order: [rabbit, ...s.flow!.order.filter(id => id !== rabbit)] } }; // rabbit first
}
const bunny = [{ letter: 'B', because: 'bunny' }];

test('alsoAccept: only for first-letter photos; 1–3 different capital letters, each given by a word starting with it', () => {
  const base = { word: 'jacket', activity: 'initial' as const };
  expect(validAlsoAccept({ ...base, alsoAccept: [{ letter: 'C', because: 'coat' }] })).toBe(true);
  expect(validAlsoAccept({ ...base })).toBe(true);
  for (const bad of [[], [{ letter: 'J', because: 'jumper' }], [{ letter: 'c', because: 'coat' }], [{ letter: 'C', because: 'jacket' }], [{ letter: 'C', because: 'Coat' }],
    [{ letter: 'C', because: 'coat' }, { letter: 'C', because: 'cardigan' }], [1, 2, 3, 4].map(() => ({ letter: 'C', because: 'coat' })), [{ letter: 'CO', because: 'coat' }]])
    expect(validAlsoAccept({ ...base, alsoAccept: bad as never }), JSON.stringify(bad)).toBe(false);
  expect(validAlsoAccept({ word: 'jacket', activity: 'spelling', alsoAccept: [{ letter: 'C', because: 'coat' }] })).toBe(false);
  const rabbit = curriculumBank.find(w => w.grade === 'K' && w.word === 'rabbit')!;
  expect(validateWords([{ ...rabbit, alsoAccept: bunny }]).errors).toEqual([]);
  expect(validateWords([{ ...rabbit, alsoAccept: [{ letter: 'R', because: 'rabbit' }] }]).errors).toHaveLength(1);
});

test('The teaching line names the alternate word and the picture’s own first letter', () => {
  const jacket = { word: 'jacket', activity: 'initial', alsoAccept: [{ letter: 'C', because: 'coat' }] } as WordEntry;
  expect(teachingLine(jacket, 'C')).toBe('Yes! Coat starts with C. This is a jacket, and jacket starts with J.');
  expect(teachingLine({ ...jacket, word: 'elephant', alsoAccept: [{ letter: 'T', because: 'trunk' }] } as WordEntry, 'T')).toBe('Yes! Trunk starts with T. This is an elephant, and elephant starts with E.');
  expect(teachingLine(jacket, 'J')).toBeUndefined();
  expect(acceptedLabel(jacket, 'C')).toBe('C (coat)');
});

test('Marking: tap moves a team through not marked → ✓ R → ✓ B (bunny) → not marked; results record "B (bunny)"; other words unchanged', () => {
  let s = game(bunny);
  expect(currentWord(s).word).toBe('rabbit');
  s = toggleTeam(s, 'team-1'); expect([s.correctTeamIds, s.acceptedAs]).toEqual([['team-1'], {}]);
  s = toggleTeam(s, 'team-1'); expect([s.correctTeamIds, s.acceptedAs]).toEqual([['team-1'], { 'team-1': 'B' }]);
  s = toggleTeam(s, 'team-1'); expect([s.correctTeamIds, s.acceptedAs]).toEqual([[], {}]);
  s = toggleTeam(toggleTeam(s, 'team-1'), 'team-1'); // Orange: B (bunny)
  s = toggleTeam(s, 'team-2'); // Purple: R
  expect(isBeeState(JSON.parse(JSON.stringify(s)))).toBe(true);
  expect(isBeeState({ ...s, acceptedAs: { 'team-3': 'B' } })).toBe(false); // not marked
  expect(isBeeState({ ...s, acceptedAs: { 'team-1': 'Z' } })).toBe(false); // not accepted for this word
  s = commitResults(s, now);
  const responses = s.session.responses.map(r => [r.teamId, r.correct, r.pointsAwarded, r.said]);
  expect(responses).toEqual([['team-1', true, 1, 'B (bunny)'], ['team-2', true, 1, undefined], ['team-3', false, 0, undefined], ['team-4', false, 0, undefined], ['team-5', false, 0, undefined], ['team-6', false, 0, undefined]]);
  expect(isBeeState(JSON.parse(JSON.stringify(s)))).toBe(true);
  // The next word starts clean; a word without alsoAccept toggles exactly as before.
  s = nextWord(s, now);
  expect(s.acceptedAs).toBeUndefined();
  const other = toggleTeam(s, 'team-1');
  expect([other.correctTeamIds, other.acceptedAs]).toEqual([['team-1'], undefined]);
  expect(toggleTeam(other, 'team-1').correctTeamIds).toEqual([]);
  expect(clearMarks(toggleTeam(toggleTeam(game(bunny), 'team-1'), 'team-1'))).toMatchObject({ correctTeamIds: [] });
  expect(clearMarks(toggleTeam(toggleTeam(game(bunny), 'team-1'), 'team-1')).acceptedAs).toBeUndefined();
});

test('Letter choices never offer an accepted letter as a wrong choice; words without alsoAccept keep their choices', () => {
  const plain = currentWord(game()), withB = currentWord(game(bunny));
  expect(letterChoices(plain, 3)).toEqual(['M', 'R', 'T']);
  expect(letterChoices({ ...plain, alsoAccept: [{ letter: 'M', because: 'mouse' }] } as WordEntry, 3)).toEqual(['R', 'S', 'T']);
  expect(letterChoices(withB, 3)).toEqual(letterChoices(plain, 3)); // B was never a filler
});

async function load(page: Page, s: BeeState) {
  await page.goto('/games');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [ACTIVE_KEY, JSON.stringify(s)]);
  await page.goto('/games/spelling-bee');
  await expect(page.getByRole('group', { name: 'Beginning letter slot' })).toBeVisible();
}

test('Class flow: a team says B for the rabbit, the teacher taps twice, Reveal teaches, and results show "B (bunny)"', async ({ page }) => {
  await load(page, game(bunny));
  // Nothing about the alternate shows before Reveal.
  await expect(page.locator('main')).not.toContainText(/bunny/i);
  const orange = page.getByRole('button', { name: /^Orange:/ }), purple = page.getByRole('button', { name: /^Purple:/ });
  await orange.click();
  await expect(orange).toContainText('✓ Pending +1');
  await orange.click();
  await expect(orange).toContainText('✓ Pending +1 · B (bunny)');
  await expect(orange).toHaveAccessibleName(/marked correct as B \(bunny\)/);
  await purple.click();
  await page.getByRole('button', { name: 'Teacher: Reveal Answer' }).click();
  await expect(page.getByTestId('bee-teach')).toHaveText('Yes! Bunny starts with B. This is a rabbit, and rabbit starts with R.');
  await expect(page.getByTestId('bee-also')).toContainText('Also correct: B (bunny).');
  await page.screenshot({ path: 'test-results/bee-also-accept-reveal.png' });
  for (const [width, height] of [[1920, 1080], [1536, 864], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), `fits at ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Commit Results' }).click();
  await expect(orange).toContainText('✓ Correct · B (bunny)');
  await expect(purple).toContainText('✓ Correct');
  await expect(purple).not.toContainText('bunny');
  await expect(page.getByRole('button', { name: /^Green:/ })).toContainText('Not correct');
  // Finish: the word results list who was accepted with B (bunny).
  await page.getByRole('button', { name: 'End Game' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /End Game|Finish/ }).click();
  await expect(page.locator('.bee-summary')).toContainText('R · rabbit · Beginning letter R and its sound · 2/6 teams correct · Accepted B (bunny): Orange');
  await page.screenshot({ path: 'test-results/bee-also-accept-results.png' });
});

test('A word without alsoAccept: one tap marks correct, a second tap clears it, and Reveal reads as before', async ({ page }) => {
  await load(page, game());
  const orange = page.getByRole('button', { name: /^Orange:/ });
  await orange.click();
  await expect(orange).toContainText('✓ Pending +1');
  await orange.click();
  await expect(orange).toContainText('Mark correct');
  await page.getByRole('button', { name: 'Teacher: Reveal Answer' }).click();
  await expect(page.locator('#bee-hint-help')).toContainText('RABBIT starts with R.');
  await expect(page.getByTestId('bee-teach')).toHaveCount(0);
  await expect(page.getByTestId('bee-also')).toHaveCount(0);
});
