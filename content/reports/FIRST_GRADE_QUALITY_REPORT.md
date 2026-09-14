# First-grade question quality correction — 2026-09-13

Prefer natural questions that test the supported concept. When an everyday document is appropriate, use familiar formats such as addresses, schedules, signs, menus, maps or labels. All needed information must be displayed. Do not invent geographic facts, place names, fake labels or placeholder scenarios merely to fill a tile. Source-backed skills may use realistic everyday examples (such as small-number word problems); a realistic format does not excuse unsupported facts, future timing or inadequate evidence. Leave unsupported slots unfilled.

## Changes

- Withdrew five artificial Social Studies replacements from the active bank. Full withdrawn records and reasons are archived in `content/withdrawn-questions.json`; regeneration checks the archived snapshots and keeps these IDs out of the app. Old local approvals cannot make absent questions playable.
- Replaced the mental-dot prompt with: “You put 4 apples in a bag, then add 3 more. How many apples are in the bag?” Answer: “7 apples.” The linked math source explicitly supports word problems to 10 for September 7–11 (1.NR.2.2). This wording change requires review; no approval was added.
- Retained the other 30 first-grade questions unchanged, preserving their existing review comparison behavior.

## Evidence gap

The linked district `support-2.json`, August 17–21 section, supports identifying city, county, state, nation and continent and their nesting relationship. It does not supply an authentic named address/map or local place names for the five withdrawn prompts. No external facts or future lesson content were added. The existing location-order question remains supported by the nesting relationship. Additional district source material is needed for stronger distinct geography questions; five variations of that ordering question would force coverage.

## Coverage

First grade now has **31 active self-contained drafts**: Literacy 12, Math 12, Science 6, Social Studies 1. Difficulty counts: 1 point 10, 2 points 10, 3 points 11. The 5 withdrawn slots are Social Studies: two 1-point, two 2-point and one 3-point.

Even if all 31 active drafts are approved, only **25 of 30 tiles** can be assigned. Full-game launch stays disabled. Actual human approvals remain browser-local. The bank has 211 active drafts overall; curriculum remains 755 records. No generation toward the 60-question target occurred.

Withdrawn IDs:

- `dcss-1-social-studies-my-state`
- `dcss-1-social-studies-city-state`
- `dcss-1-social-studies-location-country`
- `dcss-1-social-studies-location-county`
- `dcss-1-social-studies-location-fix`
