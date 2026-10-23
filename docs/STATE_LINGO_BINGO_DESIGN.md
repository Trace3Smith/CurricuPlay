# State Lingo Bingo — ClassThread game design

**Status:** Design agreed with Trace on October 22, 2026. Not built yet.
**Based on:** the "State Lingo Bingo" PE lesson (Grades 3–5, Cooperative Games unit) from the shared Master PE Lesson Plans. That lesson uses cones, hula hoops, task sheets, and printed state/capital pieces. This version keeps every physical part and gives the screen the paper and judging work.

## Content and pacing
- States and capitals are probably not on the DCSS 3–5 pacing guide. The game is **General Practice**: available on any date, clearly labeled as not district-paced, the same as Spelling Bee's general practice bank.
- The data is the 50 U.S. states and their capitals, kept in a checked-in data file with its source recorded. Trace's pool has a tile for every state's capital, so all 50 states are eligible.

## Physical setup (unchanged from how Trace runs it)
- A kiddie pool full of cut-out **capital name tiles**, with several copies of each.
- Each team has a **home hula hoop with a die**.
- A **six-exercise fitness card**: 1 jog 2 laps, 2 ten lunges, 3 five push-ups, 4 ten sit-ups, 5 twenty-five jumping jacks, 6 ten squats.
- Teams of **3–4 students**, so 8–10 teams in a class of 30.
- Trace stands at a **teacher station** next to the screen (laptop or touch board).

## How a turn works
1. **At the home hoop:** the team rolls the die and does that exercise together. The exercise is how they earn the right to dig.
2. **At the pool:** the whole team digs for the capital of the state they are currently targeting.
3. **At the teacher station:** the team brings the tile to Trace.
   - Correct: Trace taps it. The square on their card is marked, the team says the next state they want, and Trace taps it to make it their new target.
   - Wrong: Trace taps **Wrong tile**. No point, and the team goes back to dig. The wrong attempt is recorded as part of that team's assessment.
4. Back to the hoop to roll again.

The game runs until Trace presses **End**. There is no timer and no score cap.

## The board (shared screen)
- **The board splits into one section per team.** Trace picks the number of teams (2–10) in setup, and the screen divides into that many equal sections, each holding one team's bingo card. Every card is visible at once, so teams can plan their next state while they wait.
- **Fewer teams means bigger sections.** Layouts by team count:

  | Teams | Layout |
  | --- | --- |
  | 2 | 1 row of 2 |
  | 3 | 1 row of 3 |
  | 4 | 2 × 2 |
  | 5–6 | 2 rows of 3 |
  | 7–8 | 2 rows of 4 |
  | 9–10 | 2 rows of 5 |

  With an odd count, the last row is centered rather than leaving an empty section. Text and outlines scale up to fill each section.
- Each card shows the team's color and name, its **current target** highlighted, marked squares, points, and bingos.
- **State outlines behind names:** every state name on the board, both card squares and the current target, sits on top of a faint outline of that state's shape. The name stays fully readable from across the gym, and the outline is a quiet background.
- **Target pop-up:** when Trace sets a team's new target, the state name pops up large over its outline for a few seconds. It then settles into that team's card as the highlighted target. The pop-up never blocks Trace's controls.
- The **fitness card** stays in a strip along the edge of the screen.
- A completed row, column, or diagonal flashes **BINGO** on that team's card.

## Cards
- Every team gets its own randomized card. The same state may appear on several teams' cards, which is fine because the pool holds several copies of each tile.
- **4×4 (16 states)** is the default for 3rd grade. **5×5 with a free center** is the default for 4th and 5th. Trace can override either.
- **Options:**
  - **Region filter:** draw only from selected regions. A 4×4 card needs at least 16 states and a 5×5 card at least 24, so setup warns when too few are selected.
  - **Map-only mode:** squares show the state outline or its location on a U.S. map with no name, for a harder challenge.

## Scoring
- **1 point** for each correct capital.
- **+5** for each completed bingo line.
- **+20 blackout bonus** when a team fills its entire card. Trace chose to keep this so teams have a reason to keep going after their first bingo. The amount is editable in setup.
- Play continues after a team's first bingo.

## Teacher controls
- **Setup:**
  - Grade, number of teams (2–10), and card size.
  - Region filter and map-only mode.
  - Scoring values and the fitness card text, both editable.
  - Team names (see Team identity).
- **During play:** tap a team, then either mark the capital correct and choose the next target, or tap **Wrong tile**. Also **Undo** for the last tap, Full Screen, and End.
- **Recovery:** a refresh, navigating away, or a sleeping laptop resumes the game exactly as it was. This uses the same pattern as the other games.

## Team identity
- Each team gets a color automatically. The first six use the existing team colors: Orange, Purple, Green, Yellow, Red, Blue. Teams 7–10 get four more distinct colors chosen for the screen. They do not need to match physical pinnies, because teams are identified by name and home hoop.
- **Custom team names:** by default teams are "Team 1" through "Team 10." Before the game starts, Trace can type a name for any team. This lets him reward a class by letting teams pick their own names.
  - Names have a short length limit so they fit on the card.
  - Names are typed by the teacher and saved only with that game session.
- Color is never the only identifier; the name always shows.

## Assessment
- Every correct and wrong tile is recorded for each team, with the target state and the time.
- Each team gets an accuracy record: correct capitals, wrong tiles, and which states they missed.
- Use the existing shared assessment record pattern so these results appear alongside Four Corners results.
- These are team practice records. They do not show individual mastery.

## End of game
- Final scores, bingo counts, blackouts, and each team's accuracy.
- **Review list:** the capitals teams missed or took longest to find, measured from when a target was set to the correct tap.

## Engineering notes for Claude Code
- Build on the existing app. Do not start a new project. Follow the existing game structure (`src/games/...`, a Games hub entry, and a public route such as `/games/state-lingo-bingo`) with no login required.
- Saves are browser-local only. Use a new versioned key, for example `classthread.state-lingo-bingo.active.v1`, with a validated payload version. Do not touch existing game keys.
- Reuse the shared team presets and assessment record patterns where they fit. Do not change Four Corners, Jeopardy, or Spelling Bee behavior.
- The U.S. map and the individual state outlines come from a public-domain states shape file (for example, Census-derived TopoJSON) bundled locally with the app. No runtime fetches. Each state's outline is drawn at its own scale so small states like Rhode Island are still recognizable.
- The target pop-up respects reduced-motion settings (it can appear without animation).
- Check it at 1920×1080, 1536×864, and 1280×720. On phones the page can scroll, but no control may be lost.
- Tests should cover:
  - Card generation: no duplicate squares on a card, and region-size rules.
  - Bingo detection: rows, columns, diagonals, the free center, and blackout.
  - Undo, including undoing a wrong-tile tap.
  - Assessment records for correct and wrong attempts.
  - Custom team names, including the length limit.
  - Board layout for every team count from 2 to 10, at all three screen sizes.
  - Save and refresh recovery.
  - A full play-through.
- Release flow: feature branch, then a GitHub Preview, then Trace checks it, then fast-forward `main`. A merge to `main` is a production release.

## Open decisions
- None. The design is ready to build.
