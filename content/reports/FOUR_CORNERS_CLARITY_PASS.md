# Four Corners writing-and-clarity pass — September 17, 2026

This pass follows the [September 17 quality audit](FOUR_CORNERS_QUALITY_AUDIT.md) and changes **writing only**. No question was added, withdrawn, retargeted, or re-keyed. Every `correctIndex` is byte-identical to the audited bank, the A 67 / B 66 / C 65 / D 66 distribution is unchanged, per-grade and per-subject counts are unchanged at 264 active items, and no evidence, standard, curriculum, pacing, delivery, or review field was touched. Jeopardy, its banks, its shared services, and its tests were not modified.

## What changed

| Change | Count |
|---|---:|
| Items with any prompt or choice rewording | 65 of 264 |
| Prompts reworded | 52 |
| Items with an edited choice set | 17 (21 individual choices) |
| Answer strings restated (same choice, same position) | 3 |
| Reveal-line explanations written | 264 of 264 (was 0) |

Longest prompt (141 characters) and longest choice (59 characters) are unchanged, and mean prompt length moved from 67.5 to 67.8 characters, so the 1920×1080 single-screen layout carries the same text load as the audited bank.

### Explanations

`explanation` was already a rendered field: the reveal footer prints `Correct answer: B — {explanation}`. All 264 active items carried an empty or absent value, so every reveal read only `Correct answer: B`. Each item now has one sentence, at most 80 characters, stating **why** the key is correct — and, where a distractor encodes the likely misconception, why the others are not. These are teacher-facing reveal lines, not new instructional content: each one restates information already present in the prompt, the choices, or the cited skill.

- `fc-tomorrow-2-science-sun-star` → "The Sun is a star. It looks different only because it is so close to us."
- `fc-expanded-4-weather-observation` → "An observation reports what already happened; a prediction looks ahead."
- `fc-expanded-K-t-sound` → "Top begins with /t/. Bed begins with /b/, sun with /s/, and map with /m/."

### Representative prompt and choice rewrites

**Unreadable notation a teacher cannot say aloud**

- `fc-tomorrow-dcss-1-literacy-short-u` — *Which word has the short /ŭ/ sound in the middle?* → *Which word has the short u sound in the middle?* The sibling item `fc-expanded-1-hop-hope` already said "short o sound"; the breve was the outlier.
- `fc-expanded-1-county` — *In the order city → county → state, what comes between city and state?* → *Which place is bigger than a city but smaller than a state?*
- `fc-tomorrow-5-science-sequence` — all four choices moved from `Weathering → erosion → deposition` to `Weathering, then erosion, then deposition`, matching the two-step sibling item `fc-tomorrow-5-science-compare`.

**Stems with no subject, or that doubled back on themselves**

- `fc-expanded-2-sky-reference` — *Why compare the Moon with the same tree in two observations?* → *Why should you compare the Moon to the same tree each time you look?*
- `fc-expanded-2-mayor-governor` — *Which comparison is correct?* → *Which sentence about a mayor and a governor is correct?*
- `fc-expanded-4-weather-units` — *What missing information tells how to read this temperature?* → *What information is missing?*
- `fc-expanded-5-surface-location` — *Which process has occurred without erosion being shown?* → *Which process has happened?*

**Vocabulary above the grade being tested**

- `fc-expanded-1-needs-observation` (grade 1) — *Which observation shows…* → *Which one shows…*
- `fc-expanded-2-observation-not-guess` (grade 2) — *Which sentence reports only what was observed?* → *Which sentence tells only what someone actually saw?*
- `fc-expanded-3-summary-fix` (grade 3) — *Which sentence would be inaccurate in a summary?* → *Which sentence would NOT be true in a summary?*
- `fc-expanded-1-ending-sequence` (grade 1) — *Which word introduces the final event?* → *Which order word tells about the last event?*

**Choices carrying two ideas, or one idea stated twice**

- `fc-tomorrow-2-science-distance` — D `It is closer to every other star than to Earth.` → `Other stars are much closer to Earth.`
- `fc-expanded-2-sky-shift` — B `Its apparent position` → `Where it appears in the sky`, the only academic phrase among four concrete choices.
- `fc-tomorrow-1-science-water` — B `A larger pot with no water` → `A bigger pot`.
- `fc-expanded-2-scarcity-money` — C `Pay after spending the same money twice.` → `Spend the same money twice.`

**Ambiguity that could change a pupil's answer**

- `fc-expanded-3-compass-route` — *…then turn around* → *…then turn all the way around*, so the half turn is stated rather than inferred.

## Classroom-play fixes — September 17, 2026

Three items flagged during real classroom play, corrected after the clarity pass. Same rule set: keys, positions, counts, and citations unchanged.

| Item | Change | Key |
|---|---|---|
| `fc-expanded-3-transition-first` | Stem *"Which word usually signals the first step in directions?"* → *"Which word signals the beginning of a set of directions?"* | `First` (D) unchanged |
| `fc-expanded-1-county` | Stem → *"Douglasville is a city in Georgia. It sits inside a larger place called Douglas. What kind of place is Douglas?"*; reveal line updated to match | `County` (C) unchanged |
| `fc-expanded-1-plant-nutrients` | Choice A `Prepared food` → `Crayons` | `Nutrients` (D) unchanged |

The first two removed answer-word giveaways: each stem repeated the key, so the item could be solved by word matching rather than by the skill. A guard in the fix script now asserts the normalised key does not appear in its own stem. The third replaced a distractor that is ambiguous at grade 1, since plants make their own food, with an unambiguously unrelated object; that removes one of the two animal-need contrasts, leaving `Shelter` to carry the plant-versus-animal comparison.

`fc-expanded-1-county` cites the pupils’ own city and county. Both Douglasville and Douglas County appear in `content/sources`, and the item’s evidence quote — *"I can identify and describe my city, county, state, nation, and continent"* — is unchanged.

Ledger records for these three carry `classroomFixNotes`; `content/four-corners/quality-audit.json` records `classroomFixDate`.

## Printed-letter corner labels — September 17, 2026

Display change only. No question text, key, position, count, or citation was touched; `src/data/four-corners.json` and `content/four-corners/quality-audit.json` were not written by this change.

On the four `delivery: look-at-print` questions the choices are themselves letters, so the 60px A/B/C/D label competed with the letter under test. `fc-expanded-K-letter-name` put the letter **B** in slot **B** while the key **M** sat under slot **A**; `fc-expanded-K-a-match` put "A and a" in slot **A**; `fc-expanded-K-s-match` put "a" in slot **B** and "b" in slot **C**. A five-year-old cannot reliably separate the letter naming a corner from the letter being asked about.

On those four rounds only, the corner identity is now a shape plus the word "Corner A" — a small uppercase sign rather than a bare glyph — and the choice sits on a high-contrast card:

| | Non-print rounds | Printed-letter rounds |
|---|---|---|
| Corner label | `A` 60px amber | `● CORNER A` 19px muted, token 31px |
| Choice | 37px text, inline | 68px on a light card |
| Reveal line | `Correct answer: B` | `Correct answer: ▲ corner B` |

The set is selected by `delivery === 'look-at-print'`, the category the quality audit already established, so no new data field was introduced. Shapes carry `aria-hidden`; the word "Corner A" remains the accessible name, and shape, word and grid position all encode the same thing, so colour is never the only channel. Existing corner signage stays valid: the tile still says "Corner A", and a shape card taped under each sign is optional reinforcement, not a requirement.

The `.fc-read` cue text is unchanged, so the existing printed-letter regression passes untouched. A new test asserts the shape scheme renders on exactly those four items, that no bare `<b>` label survives there, that the reveal line names the shape, and that a neighbouring K literacy question still renders `A`, `B`, `C`, `D` — a new guarantee, not a relaxed one. Suite: 69 passing, up from 68. Screenshots for all four items land in `test-results/four-corners-print-*.png`.

## Skill and key preservation

Three answer strings were restated. In each case the key stayed in its original position and kept its meaning:

| Item | Before | After |
|---|---|---|
| `fc-tomorrow-5-science-sequence` (D) | Weathering → erosion → deposition | Weathering, then erosion, then deposition |
| `fc-expanded-2-sky-shift` (B) | Its apparent position | Where it appears in the sky |
| `fc-expanded-2-sky-ask` (B) | How much light each appears to give off | How much light each one seems to give off |

Deliberate distinctions from the quality audit were left alone. The four `look-at-print` letter items keep their delivery flag and their on-screen cue, and are still not described as comprehension or spoken-word recognition. `fc-tomorrow-dcss-K-literacy-letter-match` moved from "small letter" to the curriculum's "lowercase" without changing what the pupil looks at. Answer-word giveaways resolved earlier were not reintroduced: `fc-expanded-2-sky-ask` was tightened in the stem rather than in the key, so the key still does not echo the prompt's wording.

## Effect on the similarity report

Prompt-similarity candidates fall from **12 pairs to 8**, with no new pair introduced. Four were resolved by varying stems that had become word-for-word twins:

| Pair | Before | After |
|---|---:|---|
| `letter-sound` / `t-sound` | 0.971 | resolved |
| `map-latitude` / `map-longitude` | 0.937 | resolved |
| `t-sound` / `b-sound` | 0.835 | resolved |
| `letter-match` / `s-match` | 0.767 | resolved |

The eight remaining pairs are the ones the audit already reviewed and accepted: parallel short-vowel items, two ordering items, two U.S.-landform items, and a compound-word pair. The three repeated unordered choice sets are unchanged and remain intentional.

## Coverage gaps — unchanged

This pass adds no questions, so every gap the audit recorded still stands:

- Spoken-target sight-word recognition is still unsupported in this shared-screen format; K ELA remains 15, so **20-round K ELA is still unavailable**.
- The withdrawn grade-1 isolated vowel-letter item still has no replacement (ELA 17).
- Shortages against 15 per subject: K Science −5; grade 1 Social Studies −3; grade 2 Science −3; grade 3 Science −3 and Social Studies −3; grade 5 Science −3.
- Eight grade-3 globe/direction and nine grade-5 economics/community items still assert no standard code. Rewording their prompts does not create alignment, and none was claimed.
- Explanations are editorial reveal lines. They are **not** teacher-approved curriculum text and carry no standard or evidence citation of their own.

## Ledger and verification

`content/four-corners/quality-audit.json` keeps its 270 records, its immutable `before` states, and all six withdrawals. Every record touched by this pass now carries:

- `disposition: "clarified"`,
- `qualityDisposition`, holding the audit's original verdict (`preserved` or `revised`) so the 230 / 34 / 6 outcome stays readable per item,
- `clarityNotes`, the reason for each wording change.

`scripts/validate-four-corners.py` gained two report keys — `qualityAuditOriginalDispositions` and `itemsWithExplanation`. No check was removed, relaxed, or added, and no test was modified.

Validation run for this pass: `npm run content:validate` zero errors and zero warnings; `python3 scripts/validate-four-corners.py` zero errors and zero unreviewed changes; `npx playwright test --workers=2` 68/68 passing; `npm run build` passing with Vite's existing nonblocking chunk-size warning. Work remains on `four-corners-mvp`. Nothing merged, pushed, or deployed.
