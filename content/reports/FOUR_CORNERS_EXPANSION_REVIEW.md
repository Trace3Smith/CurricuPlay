> Historical report: superseded by [the September 17 question-and-choice quality audit](FOUR_CORNERS_QUALITY_AUDIT.md). Current bank: 264 questions; the original preservation and coverage claims below describe the earlier state.

# Four Corners expansion — editorial and source review

The original 90 MVP records are unchanged, checked against `content/four-corners/mvp-baseline.json`. The expanded bank contains 180 additional items: 58 conversions of existing CurricuPlay questions and 122 new exercises applying locally documented taught skills. Including the original 90 conversions, 148 bank items are conversions.

## Source boundaries

All items retain a primary DCSS pacing row with a date no later than September 13, 2026. New linked-lesson evidence was matched to the existing grade/subject/week rows without editing the curriculum service, Jeopardy bank, or pacing data. Source excerpts are checked against local document snapshots. No new documents or live image services were fetched.

- K: day/night observations and dawn/dusk models; citizenship; taught letters, sight words, actions, and short read-aloud details. Science stops at 10 rather than adding another five variants of the same sky facts. ELA supplies 20 distinct letter/word/reading targets. The math-only positional sequence and future living/nonliving units were not imported into Science.
- Grade 1: basic plant/animal needs plus plant parts from the September 7 pacing row (`S1L1.a`); city/county/state/nation/continent and August patriotic vocabulary; short-vowel and sequence skills. Social Studies stops at 12. No unsupported new real-location facts were added. ELA supplies 18.
- Grade 2: size/brightness and sky observation practices; government, rules, scarcity, goods/services and needs/wants explicitly listed in the August linked lesson; compound words and contextual vocabulary. Science stops at 12; no fusion, stellar taxonomy, or later forces/life-science material. ELA supplies 18.
- Grade 3: observable rock properties and fair comparisons; maps/globes and the already-evidenced compass; brief narrative summaries and transitions. Science and Social Studies each stop at 12. No repeated named-river classifications, speculative geography, advanced mineral tests, or unverified Native American history. ELA supplies 21 distinct passages/tasks.
- Grade 4: weather/moon observation records; the Revolution portion of the linked New Nation deck; cause/effect and main idea. No erroneous Declaration signing date questions or later historical units. All three subjects reach 15.
- Grade 5: weathering/erosion/deposition observations and evidence; rights/responsibilities and community/business concepts supported by the current lesson; narrative details, inferences, change, and theme. Science stops at 12 rather than adding three more process-name swaps. ELA supplies 18. No future chemical-change, electricity, magnetism, or classification items; no erroneous citizenship answer keys or naturalization claims.

Original reading passages, observation records, and schematic diagrams are practice examples for the cited skills. They are not represented as quotations from district books, real measured weather data, or maps of actual unnamed communities. Required information is on screen. New prompts avoid arbitrary invented personal names and fake location cards.

## Choice and ambiguity review

Each new prompt and its four options were reviewed for one defensible answer, grade-level wording, self-contained information, and plausible errors. Exact answer mapping and distinct choices are also machine-checked. Automated checks alone cannot establish semantic correctness.

Review revisions before the final run:

- Replaced a redundant grade-1 short-i matching exercise with an initial-sound substitution from an existing blend/change-sound question.
- Changed the new grade-2 brightness item to an observation-planning task, distinct from the retained brightness vocabulary question.
- Changed the grade-1 plant-model distractors to plausible confusion between plant parts and growing materials, instead of mixed animal/plant lists.
- Replaced irrelevant weather-unit and silt-fence distractors with related observation/process alternatives.
- Clarified that the distance illustration is a side-view model, avoiding confusion between drawing size and apparent size to the observer.
- Corrected the local Moon drawing to use a continuous mostly-lit shape.

Teacher-facing “Accept…” language, unavailable worksheets/books/charts, advanced out-of-scope vocabulary, computational work, and multiple-answer options are excluded. The baseline “accept help” phrase is ordinary story language, not teacher-facing answer instructions.

## Duplicate review

`FOUR_CORNERS_EXPANSION_VALIDATION.json` includes every within-grade/subject prompt pair scoring at least 0.72 normalized sequence similarity, plus every repeated unordered choice set. Zero duplicate IDs and zero exact normalized prompts were found.

Similarity candidates were reviewed by instructional target, not dismissed or accepted by score alone:

- K letter/sound prompts assess different explicitly taught letters (M, T, S, B), not renaming the same example. Sight-word prompts assess different listed words (`in`, `is`, `you`, `that`, `it`). The shared short instruction supports teacher reading. Recognition and applying a word in a sentence are distinct tasks.
- Grade-1 vowel items distinguish /a/, /e/, /i/, /o/, /u/, blending, and substitution. The redundant additional /i/ match was replaced. Event-order items concern different meaningful sequences; they are not a reskin of the same passage.
- Latitude and longitude questions distinguish the two different coordinates students must learn. They are not interchangeable rewordings.
- The Declaration purpose and author questions ask distinct historical facts.
- Existing Georgia/Atlanta prompts and other baseline similarity candidates were retained as instructed: different real place categories, not duplicate academic answers.

Three repeated choice sets are intentional: the two retained city/state/nation/continent items; the two retained Earth-process items; and the new compass turn versus map-relative-location items. The compass tasks both need the four cardinal directions but assess different reasoning. Changing options just to evade this check would weaken those items.

## Answer-position audit

Whole bank: A 68, B 68, C 67, D 67. Each grade has 11 or 12 correct answers in each position. New items use a seeded shuffled allocation, not a cyclic A/B/C/D assignment. The longest run in the new authoring sequence is three; lag-four position matching is 0.239, not a repeating four-position cycle. The original 90 answer positions were left unchanged. Gameplay also shuffles question order and interleaves subjects; file order is not game order.
