# Classroom fixes — Preview release review

Base release: `3c52918`, `classthread-spelling-bee-pacing`.
Working branch: `classthread-spelling-bee-classroom-fixes`.
Review URL: http://localhost:5173/games/spelling-bee
Release scope: commit and push this branch, then deploy and verify a Preview in the existing curricu-play project. No main merge, database migration, or Production promotion is authorized. Local Vercel linking is ignored by Git.

## Gameplay

- Kindergarten has no timer, countdown controls, or timer instructions. Correct teams can be marked and results committed immediately; each correct team still earns one point. Its picture fills the reclaimed space.
- In Grades 1–5, each new round waits with a 5:00 timer initially. Teachers choose 0:30 through 5:00 in 30-second steps while it is ready. Their selected duration carries into subsequent rounds and repeat cycles in the same session.
- Start, Pause, Resume, Reset, and Teacher: End Round Early are explicit controls. A running timer persists its absolute deadline; paused time stays frozen. Background tabs, navigation, refresh, and device sleep do not grant extra time.
- Expiration displays STOP WORKING and emits two short tones when browser audio is enabled. It never reveals the answer, marks teams, commits responses, or awards points automatically.
- Team marking and Commit Results unlock at expiration or explicit early end. Correct teams receive exactly one point, all others zero, regardless of speed. Reset clears only uncommitted marks. Next Word waits for Start again.
- Kindergarten ignores any historical timer and preserves draft marks and scores. Old untimed Grades 1–5 saves remain readable. Untouched rounds gain a ready timer; rounds already revealed or marked retain their teacher work and open scoring. Existing completed history and storage keys remain unchanged.
- Session changes are saved in a layout effect before the updated screen is painted, with a regression check for immediate summary refresh.
- NON-FICTION is a presentation of the canonical `nonfiction` answer. The always-visible hyphen is not a letter slot or hint index. Source metadata, spoken word, and scoring keep the canonical answer. Validated hyphenated custom words are supported; existing nonfiction snapshots receive the display fallback.

## Image audit

43 locally stored, AI-generated photorealistic WebP images replace or supplement the picture catalog. Every generated image was visually reviewed for recognizable subject, pairing, background, and absence of written answers. Full generation prompts, filenames, tool provenance, and review statement are retained in [photo-assets.json](photo-assets.json). Assets are in `public/spelling-bee/photos/`; no external image URLs or hotlinks are used.

All 32 October 9-eligible Kindergarten prompts now use realistic pictures:

| Beginning letter | Reviewed objects |
| --- | --- |
| M | map, moon, mug, mitten, mouse, magnet, mushroom |
| T | tent, top, turtle, tomato, tiger, towel |
| A | apple, ant, ax |
| S | sun, sock, soap, seal, sandwich, spoon, suitcase |
| B | ball, bat, bed, bell, bus, bag, boat, book |
| I | igloo |

Sandwich shows bread with visible fillings. Igloo now has a blue background and stronger block-edge contrast; its exact edit prompt is recorded in [igloo-edit.md](igloo-edit.md). Approved bag, mitten, and baseball bat artwork is unchanged apart from format compression. Kindergarten continues to show only a hidden beginning-letter slot, with generic picture text and spoken-object support. The extra cat picture replaces its shared catalog image without changing its excluded Kindergarten pacing status.

The Grade 1–2 audit added realistic pictures for shrimp, mat, pin, cap, can, patch, string, strip, sprig, and scrap, alongside the shared cat and Kindergarten pictures. Shrimp shows the curved shell, antennae, legs, and fan tail. Twelve clue wordings were clarified (shrimp, bag, pin, sprig, scrap, strip, patch, shop, chin, path, king, match). Remaining existing illustrations are retained where helpful; sentence clues, actions, body parts, and abstract words continue to use teacher read-aloud or speech rather than a forced object picture. This pass does not claim every Grade 1–2 word has a photograph.

All 32 eligible Kindergarten image replacements and the requested shrimp replacement are complete. Generated pictures are editorial practice assets, not district-supplied images or additional curriculum evidence. Teacher suitability approval is still required. The reproducible bank generator retains the new pairings, clues, and hyphenated presentation.

## Preservation and verification

The October 9, 2026 cutoff and curriculum evidence are unchanged. Eligible counts remain K: 32, Grade 1: 42, Grade 2: 40, Grade 3: 40, Grade 4: 40, Grade 5: 41. Current/Review selection, explicit repeat cycles, teacher lists, six team colors, committed-response assessments, history, and Continue remain covered by regression tests. No Jeopardy, Four Corners, teacher platform, authentication, or infrastructure source files were edited.

The added browser walkthroughs exercise untimed Kindergarten igloo, timed Grade 2 shrimp, and timed Grade 5 NON-FICTION: real image loading, hidden answers, timer selection, pause/resume, refresh, expiration, scoring, reveal, reset, next round, and summary. Additional checks cover expiry audio oscillator calls, no per-tick storage writes, navigation away and Continue, mobile width, and 1920×1080 / 1536×864 / 1280×720 viewports. The latter two model 125% / 150% Windows scaling; physical Smart Board hardware is not available here.

## Practical limitations

Final release checks (October 11, 2026): **240 tests passed** in the full regression suite (3.9 minutes), including the new untimed Kindergarten and immediate-summary-save checks. TypeScript, production build, all three content validators, and diff whitespace checks passed. Kindergarten, Grade 2, and Grade 5 browser flows and 1080p/125%/150% layout checks passed. The existing large-bundle build warning remains informational.

Previous classroom-pass checks: **238 tests passed** in the full Playwright regression suite (4.1 minutes); TypeScript checking and the production build passed; all three content validators passed; `git diff --check` passed. The content generator reproduces the edited banks and evidence exactly. Browser screenshots for Kindergarten, Grade 2, and Grade 5 were visually inspected after the final run, including scaled layouts.

- Browsers require a user gesture to enable sound. Start/Resume enables it; after refreshing a running round, tap Enable Timer Sound. The visible expiry signal works even with muted or unavailable speakers. Physical school speaker volume still needs a classroom check.
- Timer recovery uses the device's wall clock. Changing the operating-system clock during a round changes its deadline interpretation.
- Saved rounds retain their original word snapshots and clues. New games use the polished bank; shared picture IDs and NON-FICTION presentation also improve compatible old snapshots.
- Compressed assets total 3,945,974 bytes (3.76 MiB), versus 89,297,742 bytes of original PNGs (85.16 MiB), a 95.6% reduction. WebP quality 88 at up to 1024 pixels retains clear object detail. Saved picture IDs are unchanged; Vercel redirects old PNG URLs to WebP. The original PNGs are archived locally outside the served app. This is not a newly implemented offline/PWA cache.
- The production build still reports the existing large JavaScript chunk warning; splitting unrelated game bundles was outside this pass.

## Changed files

- Timer: `src/games/spelling-bee/timer.ts`, `RoundTimer.tsx`.
- Game, compatibility, and presentation: `SpellingBee.tsx`, `WordBank.tsx`, `engine.ts`, `storage.ts`, `words.ts`, `spelling-bee.css` in the same directory.
- Content: `src/data/spelling-bee-pacing.json`, `spelling-bee-general.json`, `spelling-bee-pictures.json`; `content/spelling-bee/build-bank.py`, this report, photo manifest, igloo edit record, and 43 WebP assets.
- Validation: `scripts/validate-spelling-bee.py`, `scripts/validate-spelling-bee-pacing.py`.
- Tests: new `tests/spelling-bee-classroom-engine.spec.ts`, `tests/spelling-bee-classroom.spec.ts`; existing Spelling Bee engine, browser, pacing-engine, and pacing-browser tests updated to explicitly end timed rounds before scoring.

- Release asset support: `scripts/optimize-spelling-bee-images.mjs` and the image-only compatibility redirect in `vercel.json`.
