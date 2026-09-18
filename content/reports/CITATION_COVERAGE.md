# Citation coverage — generated, do not edit by hand

Produced by `scripts/report-citations.py`. Inventory only. The pacing citation (curriculumId, weekIntroduced, evidence quote) is enforced by the validators. The standard code is optional everywhere and is compared against the pacing workbook here for visibility, not enforcement.

| Bank | Items | Pacing citation missing | Standard verified | Standard unverified |
|---|---:|---:|---:|---:|
| `four-corners` — Four Corners runtime | 264 | 0 | 143 | **121** |
| `tomorrow-pack` — Jeopardy classroom bank | 180 | 0 | 126 | **54** |
| `questions` — Draft bank: Jeopardy drafts source and Review UI | 211 | 0 | 139 | **72** |
| **All banks** | **655** | **0** | **408** | **247** |

## Standard-code provenance

| Bucket | Items | Meaning |
|---|---:|---|
| `codeInPacingRow` | 408 | Standard code appears literally in its pacing-guide row. Verified. |
| `codeInLinkedSourceOnly` | 39 | Standard code is absent from the pacing row but appears in the cited linked document. |
| `nullWithSessionInPacingRow` | 191 | No standard code; session label matches the pacing row. Timing corroborated, alignment unasserted. |
| `nullWithSessionNotInPacingRow` | 17 | No standard code; the session field holds text that is in no pacing row. |

## Cross-bank disagreements

One bank withholds or cannot corroborate a code another bank asserts for the same source item. A derived item remapped to a different week legitimately carries that row’s code and is not listed. 4 anchors, 17 unverified questions:

- `tomorrow-3-social-studies-intermediate-direction` — four-corners: ['None'], tomorrow-pack: ['SS3G1']
- `tomorrow-3-social-studies-opposite-direction` — four-corners: ['None'], tomorrow-pack: ['SS3G1']
- `tomorrow-3-social-studies-river` — four-corners: ['None', 'SS3G1'], tomorrow-pack: ['SS3G1']
- `tomorrow-5-social-studies-responsibility` — four-corners: ['None', 'SS5CG1'], tomorrow-pack: ['SS5CG1']

## Systemic notes

- No standard-code check runs against src/data/four-corners.json. scripts/validate-four-corners.py verifies the pacing row and the evidence quote but never reads the standard field.
- scripts/build-tomorrow-pack.py line 25 is the only standard-vs-pacing check in the repository, and it covers the Jeopardy pack only.
- 0 of 222 Literacy pacing rows carry any standard code. The FY27 workbook records Literacy as program and session references (Heggerty week N, U1: Sessions 3-7), not codes, in every tab. Literacy items are therefore anchored by session, and a code cannot be recovered from this source.
- A null standard passes the runtime guard in src/services/questionEngine.ts whenever any non-empty session string is present. That is a presence check, not a curriculum check.

## Per-bank item lists

### `four-corners`

- **codeInPacingRow** — 143 items (verified; not listed)

- **codeInLinkedSourceOnly** — 18 items

  `fc-expanded-5-change-puzzle`, `fc-expanded-5-character-evidence`, `fc-expanded-5-character-generous`, `fc-expanded-5-dialogue`, `fc-expanded-5-dialogue-contrast`, `fc-expanded-5-feelings-action`, `fc-expanded-5-plot-cause`, `fc-expanded-5-setting-action`, `fc-expanded-5-setting-evidence-new`, `fc-expanded-5-theme-empathy`, `fc-expanded-5-theme-help`, `fc-expanded-5-theme-patience`, `fc-expanded-5-theme-sharing`, `fc-tomorrow-dcss-5-literacy-character-action`, `fc-tomorrow-dcss-5-literacy-character-change`, `fc-tomorrow-dcss-5-literacy-dialogue-inference`, `fc-tomorrow-dcss-5-literacy-setting-evidence`, `fc-tomorrow-dcss-5-literacy-theme-evidence`

- **nullWithSessionInPacingRow** — 86 items

  `fc-expanded-1-bag-order`, `fc-expanded-1-blend`, `fc-expanded-1-ending-sequence`, `fc-expanded-1-hop-hope`, `fc-expanded-1-missing-event`, `fc-expanded-1-same-vowel`, `fc-expanded-1-sandwich-order`, `fc-expanded-1-sequence-before`, `fc-expanded-1-short-a`, `fc-expanded-1-short-e`, `fc-expanded-1-sound-change`, `fc-expanded-1-story-retell`, `fc-expanded-1-toy-next`, `fc-expanded-2-compound-build`, `fc-expanded-2-compound-ground`, `fc-expanded-2-compound-snow`, `fc-expanded-2-compound-tooth`, `fc-expanded-2-context-clue`, `fc-expanded-2-context-damp`, `fc-expanded-2-context-delighted`, `fc-expanded-2-context-frigid`, `fc-expanded-2-context-gather`, `fc-expanded-2-context-hollow`, `fc-expanded-2-context-stroll`, `fc-expanded-2-context-sturdy`, `fc-expanded-2-context-whisper`, `fc-expanded-3-result-infer`, `fc-expanded-3-sequence-meaning`, `fc-expanded-3-sequence-summary`, `fc-expanded-3-story-detail`, `fc-expanded-3-story-ending`, `fc-expanded-3-story-goal-infer`, `fc-expanded-3-story-problem-new`, `fc-expanded-3-story-solution-new`, `fc-expanded-3-summary-cause`, `fc-expanded-3-summary-fix`, `fc-expanded-3-summary-important`, `fc-expanded-3-summary-passage`, `fc-expanded-3-transition-cause`, `fc-expanded-3-transition-ending`, `fc-expanded-3-transition-first`, `fc-expanded-3-transition-next`, `fc-expanded-4-cause-chain`, `fc-expanded-4-cause-two`, `fc-expanded-4-detail-support`, `fc-expanded-4-effect-bell`, `fc-expanded-4-evidence-envelope`, `fc-expanded-4-main-belong`, `fc-expanded-4-main-many`, `fc-expanded-4-main-organize`, `fc-expanded-4-main-title`, `fc-expanded-4-main-too-narrow`, `fc-expanded-K-a-match`, `fc-expanded-K-action-word`, `fc-expanded-K-b-sound`, `fc-expanded-K-detail-color`, `fc-expanded-K-detail-object`, `fc-expanded-K-detail-place`, `fc-expanded-K-detail-sound`, `fc-expanded-K-detail-weather`, `fc-expanded-K-detail-who`, `fc-expanded-K-letter-name`, `fc-expanded-K-s-match`, `fc-expanded-K-t-sound`, `fc-tomorrow-dcss-1-literacy-events-first`, `fc-tomorrow-dcss-1-literacy-events-last`, `fc-tomorrow-dcss-1-literacy-events-middle`, `fc-tomorrow-dcss-1-literacy-short-u`, `fc-tomorrow-dcss-2-literacy-compound-parts`, `fc-tomorrow-dcss-2-literacy-compound-select`, `fc-tomorrow-dcss-2-literacy-context-evidence`, `fc-tomorrow-dcss-2-literacy-context-tiny`, `fc-tomorrow-dcss-2-literacy-context-weary`, `fc-tomorrow-dcss-3-literacy-story-problem`, `fc-tomorrow-dcss-3-literacy-story-wanted`, `fc-tomorrow-dcss-3-literacy-summary-five`, `fc-tomorrow-dcss-3-literacy-summary-somebody`, `fc-tomorrow-dcss-3-literacy-transition-result`, `fc-tomorrow-dcss-4-literacy-cause-rain`, `fc-tomorrow-dcss-4-literacy-effect-missed`, `fc-tomorrow-dcss-4-literacy-main-detail`, `fc-tomorrow-dcss-4-literacy-main-revise`, `fc-tomorrow-dcss-4-literacy-main-topic`, `fc-tomorrow-dcss-K-literacy-letter-match`, `fc-tomorrow-dcss-K-literacy-letter-sound`, `fc-tomorrow-dcss-K-literacy-sight-complete`

- **nullWithSessionNotInPacingRow** — 17 items

  `fc-expanded-3-compass-map`, `fc-expanded-3-compass-route`, `fc-expanded-3-map-equator`, `fc-expanded-3-map-latitude`, `fc-expanded-3-map-longitude`, `fc-expanded-3-map-meridian`, `fc-expanded-5-community-contributions`, `fc-expanded-5-consumer`, `fc-expanded-5-entrepreneur`, `fc-expanded-5-goods`, `fc-expanded-5-government-rules`, `fc-expanded-5-producer`, `fc-expanded-5-services`, `fc-expanded-5-taxes-services`, `fc-expanded-5-tradeoff`, `fc-tomorrow-3-social-studies-intermediate-direction`, `fc-tomorrow-3-social-studies-opposite-direction`

### `tomorrow-pack`

- **codeInPacingRow** — 126 items (verified; not listed)

- **codeInLinkedSourceOnly** — 9 items

  `tomorrow-dcss-5-literacy-change-end`, `tomorrow-dcss-5-literacy-character-action`, `tomorrow-dcss-5-literacy-character-change`, `tomorrow-dcss-5-literacy-dialogue-inference`, `tomorrow-dcss-5-literacy-setting-evidence`, `tomorrow-dcss-5-literacy-theme-evidence`, `tomorrow-dcss-5-literacy-theme-help`, `tomorrow-dcss-5-literacy-theme-reject`, `tomorrow-dcss-5-literacy-theme-sharing`

- **nullWithSessionInPacingRow** — 45 items

  `tomorrow-dcss-1-literacy-events-first`, `tomorrow-dcss-1-literacy-events-last`, `tomorrow-dcss-1-literacy-events-middle`, `tomorrow-dcss-1-literacy-events-order`, `tomorrow-dcss-1-literacy-retell-fix`, `tomorrow-dcss-1-literacy-retell-sequence`, `tomorrow-dcss-1-literacy-short-u`, `tomorrow-dcss-1-literacy-vowel-identify`, `tomorrow-dcss-1-literacy-vowel-repair`, `tomorrow-dcss-2-literacy-compound-build`, `tomorrow-dcss-2-literacy-compound-explain`, `tomorrow-dcss-2-literacy-compound-finish`, `tomorrow-dcss-2-literacy-compound-parts`, `tomorrow-dcss-2-literacy-compound-select`, `tomorrow-dcss-2-literacy-compound-use`, `tomorrow-dcss-2-literacy-context-evidence`, `tomorrow-dcss-2-literacy-context-tiny`, `tomorrow-dcss-2-literacy-context-weary`, `tomorrow-dcss-3-literacy-story-problem`, `tomorrow-dcss-3-literacy-story-wanted`, `tomorrow-dcss-3-literacy-summary-five`, `tomorrow-dcss-3-literacy-summary-somebody`, `tomorrow-dcss-3-literacy-transition-cause`, `tomorrow-dcss-3-literacy-transition-first`, `tomorrow-dcss-3-literacy-transition-next`, `tomorrow-dcss-3-literacy-transition-result`, `tomorrow-dcss-3-literacy-transition-write`, `tomorrow-dcss-4-literacy-cause-evidence`, `tomorrow-dcss-4-literacy-cause-rain`, `tomorrow-dcss-4-literacy-effect-missed`, `tomorrow-dcss-4-literacy-main-build`, `tomorrow-dcss-4-literacy-main-detail`, `tomorrow-dcss-4-literacy-main-revise`, `tomorrow-dcss-4-literacy-main-title`, `tomorrow-dcss-4-literacy-main-topic`, `tomorrow-dcss-4-literacy-main-unrelated`, `tomorrow-dcss-K-literacy-letter-m`, `tomorrow-dcss-K-literacy-letter-match`, `tomorrow-dcss-K-literacy-letter-sound`, `tomorrow-dcss-K-literacy-sight-complete`, `tomorrow-dcss-K-literacy-sight-is`, `tomorrow-dcss-K-literacy-sight-two`, `tomorrow-dcss-K-literacy-word-in`, `tomorrow-dcss-K-literacy-word-sentence`, `tomorrow-dcss-K-literacy-word-you`

### `questions`

- **codeInPacingRow** — 139 items (verified; not listed)

- **codeInLinkedSourceOnly** — 12 items

  `dcss-5-literacy-change-end`, `dcss-5-literacy-character-action`, `dcss-5-literacy-character-change`, `dcss-5-literacy-dialogue-inference`, `dcss-5-literacy-narrative-contrast`, `dcss-5-literacy-narrative-dialogue`, `dcss-5-literacy-narrative-setting-effect`, `dcss-5-literacy-setting-evidence`, `dcss-5-literacy-theme-evidence`, `dcss-5-literacy-theme-help`, `dcss-5-literacy-theme-reject`, `dcss-5-literacy-theme-sharing`

- **nullWithSessionInPacingRow** — 60 items

  `dcss-1-literacy-blend-sun`, `dcss-1-literacy-events-first`, `dcss-1-literacy-events-last`, `dcss-1-literacy-events-middle`, `dcss-1-literacy-events-order`, `dcss-1-literacy-retell-fix`, `dcss-1-literacy-retell-sequence`, `dcss-1-literacy-short-a-read`, `dcss-1-literacy-short-u`, `dcss-1-literacy-vowel-identify`, `dcss-1-literacy-vowel-repair`, `dcss-1-literacy-vowel-sort`, `dcss-2-literacy-compound-build`, `dcss-2-literacy-compound-explain`, `dcss-2-literacy-compound-finish`, `dcss-2-literacy-compound-parts`, `dcss-2-literacy-compound-select`, `dcss-2-literacy-compound-use`, `dcss-2-literacy-context-contrast`, `dcss-2-literacy-context-damp`, `dcss-2-literacy-context-evidence`, `dcss-2-literacy-context-fix`, `dcss-2-literacy-context-tiny`, `dcss-2-literacy-context-weary`, `dcss-3-literacy-story-problem`, `dcss-3-literacy-story-wanted`, `dcss-3-literacy-summary-five`, `dcss-3-literacy-summary-fix`, `dcss-3-literacy-summary-somebody`, `dcss-3-literacy-summary-then`, `dcss-3-literacy-transition-cause`, `dcss-3-literacy-transition-ending`, `dcss-3-literacy-transition-first`, `dcss-3-literacy-transition-next`, `dcss-3-literacy-transition-result`, `dcss-3-literacy-transition-write`, `dcss-4-literacy-cause-evidence`, `dcss-4-literacy-cause-rain`, `dcss-4-literacy-cause-two`, `dcss-4-literacy-cause-unsupported`, `dcss-4-literacy-effect-missed`, `dcss-4-literacy-effect-text`, `dcss-4-literacy-main-build`, `dcss-4-literacy-main-detail`, `dcss-4-literacy-main-revise`, `dcss-4-literacy-main-title`, `dcss-4-literacy-main-topic`, `dcss-4-literacy-main-unrelated`, `dcss-K-literacy-letter-m`, `dcss-K-literacy-letter-match`, `dcss-K-literacy-letter-sound`, `dcss-K-literacy-m-build`, `dcss-K-literacy-m-listen`, `dcss-K-literacy-m-name-small`, `dcss-K-literacy-sight-complete`, `dcss-K-literacy-sight-is`, `dcss-K-literacy-sight-two`, `dcss-K-literacy-word-in`, `dcss-K-literacy-word-sentence`, `dcss-K-literacy-word-you`

