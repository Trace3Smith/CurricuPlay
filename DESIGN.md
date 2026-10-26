---
version: alpha
name: ClassThread
description: Classroom-display design system for ClassThread — navy, bright blue, orange, and green from the ClassThread logo, built first for a Smart Board viewed across a room, second for a teacher's laptop.
colors:
  primary: "#1565D8"
  on-primary: "#FFFFFF"
  primary-dark: "#0E4BA8"
  brand-blue: "#1E88F0"
  sky: "#5DB8F5"
  secondary: "#3DB54A"
  on-secondary: "#0B1F44"
  highlight: "#FFB020"
  on-highlight: "#0B1F44"
  background: "#F4F7FC"
  on-background: "#0B1F44"
  surface: "#FCFDFF"
  on-surface: "#0B1F44"
  surface-muted: "#E6EDF7"
  text-muted: "#52627C"
  outline: "#0B1F44"
  board: "#0B1F44"
  on-board: "#FFFFFF"
  success: "#1E7B3A"
  on-success: "#FFFFFF"
  warning: "#F5A000"
  on-warning: "#0B1F44"
  danger: "#B3261E"
  on-danger: "#FFFFFF"
typography:
  board-hero:
    fontFamily: Barlow Condensed
    fontSize: 120px
    fontWeight: 700
    lineHeight: 1.0
  board-title:
    fontFamily: Barlow Condensed
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.05
  board-label:
    fontFamily: Barlow Condensed
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.1
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.01em
  title:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.25
  body-lg:
    fontFamily: system-ui
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.2
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
rounded:
  sm: 8px
  md: 14px
  lg: 20px
  pill: 999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: 16px
    height: 56px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: 16px
    height: 56px
  button-accent:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: 16px
    height: 56px
  board-button:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.on-highlight}"
    typography: "{typography.board-label}"
    rounded: "{rounded.pill}"
    padding: 24px
    height: 88px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  chip-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 8px
  chip-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-warning}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 8px
  chip-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 8px
  game-board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.on-board}"
    rounded: "{rounded.lg}"
    padding: 32px
---

## Overview

ClassThread is a teacher workspace and set of classroom games. It started in one elementary school but is meant for any subject, grade, school, or district, so it has its **own brand**, not a school's colors. Its main screen is a **Smart Board** viewed from across a classroom or gym, often with the lights on, and tapped by hand. Every visual decision serves that first: readable from the back row, high contrast, finger-sized controls. Teacher planning pages (My Classroom, Plan, Resources, Manage) are used mostly on a laptop and may be calmer and denser.

The palette comes from the ClassThread logo (an open book with three cheering figures): deep navy, bright blue, sky blue, orange, and green. The layout feel is inspired by modern product sites like Teamwork.com — heavy, confident headlines, pill-shaped buttons, clear colored status chips, generous white space. It keeps the colors **solid and saturated** instead of using soft pastel gradients, because gradients and pale tints wash out on projectors. Do not copy Teamwork's logo, wording, layouts, or exact colors.

## Logo

- Use the ClassThread logo as supplied (book with three figures, navy "Class" and blue "Thread"); never redraw or recolor it.
- Horizontal logo in the app shell; the white-text version on navy `board` screens; the book-and-figures mark alone for favicon and app icon.
- Keep clear space around it equal to the height of the "C". The tagline (PLAN | TEACH | ENGAGE | ASSESS | GROW) is optional and is dropped when the logo is small.

## Two display modes

- **Board mode** (game screens, full-screen views, anything a class looks at): use `board-*` typography, `game-board` and `board-button`. Minimum on-screen text is 28px at 1920×1080; primary content (the word, the question, team names, scores) uses `board-title` or larger. One focal element per screen. No small captions, no thin weights, no muted gray text.
- **Teacher mode** (planning, setup, reports): use `headline-*`, `title`, `body-*`, `card`, chips. Body text never below 16px.

Check both modes at 1920×1080, 1536×864 and 1280×720. On phones the page may scroll, but no control may be lost.

## Colors

- `primary` blue is the brand anchor: primary buttons, active navigation, links. It is a slightly deeper shade of the logo's blue so white text on it passes contrast.
- `brand-blue` and `sky` are the logo's exact blues: use them for the logo, illustrations, and large decorative shapes, never behind body text.
- `on-background` deep navy (the "Class" in the logo) is the main text and heading color.
- `secondary` green is the accent: one secondary call to action, small brand moments, illustrations. Text on green is always navy. Use sparingly.
- `highlight` orange is the board-screen spotlight: the single most important board action, the current target, the active item. Text on orange is always navy (`on-highlight`).
- `background` is a soft off-white with a faint cool tint, not pure white; large pure-white areas cause glare on a Smart Board. Use `surface` for cards on top of it.
- `board` deep navy is the background for game screens, with white text and orange highlights.
- Status chips: `success` green, `warning` amber, `danger` red. Always include the word ("Correct", "At risk"), never color alone.

**Team colors are not part of this palette.** Games keep their existing team presets (Orange, Purple, Green, Yellow, Red, Blue; Pink, Aqua, White, Tan for teams 7–10). Some team colors resemble brand colors; that's fine because a team's name always appears with its color, for colorblind students and projector color shift. Brand colors are never used to mean a team.

Avoid: pastel tints as text backgrounds, gradients behind text, glows, low-opacity overlays, gray-on-gray. A soft gradient is allowed only as decoration on teacher-mode page headers, never behind board content.

## Typography

- **Barlow Condensed Bold** (already bundled for State Lingo Bingo under SIL OFL 1.1) is the board face: words, team names, scores, targets. Condensed letters fit long words large.
- **Plus Jakarta Sans ExtraBold/Bold** (SIL OFL 1.1) for teacher-mode headlines and titles — the heavy, friendly, geometric look. Bundle it locally the same way; no runtime font fetches.
- **system-ui** for body text and form labels.
- Sentence case for headings. Reserve ALL CAPS for very short board signals like "STOP WORKING" and "BINGO".
- Never use weights below 400; on board screens never below 700.

## Layout & Spacing

- 8px base grid (`spacing` tokens). Board screens use `xl`/`xxl` gaps; teacher pages use `md`/`lg`.
- Keep the teacher's frequent controls (Start, Correct, Wrong, Next, Undo) in the **lower half** of board screens so they're reachable without stretching, and keep them away from the edges where Smart Board touch is less accurate.
- Leave at least 16px between adjacent tap targets so the wrong team isn't tapped.

## Elevation & Depth

Flat by default. Separate surfaces with color and a 2px `outline` border rather than soft shadows, which disappear on projectors. One subtle shadow is allowed on teacher-mode cards only.

## Shapes

Buttons and chips are pills (`rounded.pill`). Cards and boards use `rounded.lg`. Inputs use `rounded.md`.

## Components

- **Buttons:** at least 56px tall in teacher mode, 88px on board screens. One primary (blue), accent (green), or board (orange) button per view; everything else secondary.
- **Cards:** `surface`, `rounded.lg`, 24px padding, 2px border on board-adjacent views.
- **Status chips:** pill, bold label, solid fill, always worded.
- **Game board:** `board` navy, white text, orange for the active/highlighted item.
- **Answer concealment:** answers, written target words, and correct-option markings are never rendered before the teacher reveals them — not in image labels, visible alt text, or styling differences between options.
- **Teacher-only content** (reports, student names beyond the current runner, private notes) never appears in board mode.

## Motion

Short and purposeful: 150–250ms for state changes, up to ~2s for celebratory signals (BINGO, target pop-up). Respect `prefers-reduced-motion` by showing the end state without animation. No looping decorative motion during play.

## Accessibility

- Meet WCAG AA contrast at minimum; aim for AAA on board screens.
- Visible focus rings (3px orange outline with navy offset) on every interactive element.
- Color is never the only signal.
- Sound is optional; every audio cue (timer end) has a visible equivalent.

## Do's and Don'ts

- Do keep one clear focal point per board screen.
- Do test on the actual Smart Board from the back of the room before release.
- Don't copy another company's branding, logos, or exact layouts.
- Don't change game save formats, storage keys, gameplay rules, or answer-reveal behavior as part of a visual restyle.
- Don't restyle everything at once: one area per feature branch → Preview → Trace's check → `main`.
