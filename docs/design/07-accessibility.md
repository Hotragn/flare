# Flare: Accessibility annotations

Version 1.0, Sat 2026-10-10. Target: WCAG 2.2 AA on every screen (SRS-A11Y-1), body text ≥ 7:1, touch targets ≥ 44 pt (SRS-A11Y-6).

## Proof (automated, Oct 10)

| Check | Tool | Scope | Result |
| --- | --- | --- | --- |
| WCAG 2.0/2.1/2.2 A and AA rules plus best practice | axe-core 4.14.0 (`npm run a11y`) | 193 targets: 189 screen states in every theme, the site at 390 and 1440 px, the prototype, the component catalog | **0 violations.** First run: 90 (17 serious): missing h1 on 9 screens, scroll region not keyboard-reachable, site without a `main` landmark, one muted ladder step at 50% opacity. All fixed. Report: design/exports/a11y-report.json |
| Keyboard focus order and touch targets | `scripts/focus-audit.mjs` (Tab through every state in Chrome) | 92 screen states | **0 targets under 44 px.** First run found the H3 "Edit where you'll be" button squeezed to 37 px; fixed with `flex: none`. Full order per screen: [07-annex-focus-order.md](07-annex-focus-order.md) |
| Color pairs, indoors and in sun | brand/tools/contrast.mjs | 22 role pairs | All pass WCAG; sun mode chosen because dark pairs drop to 1.5:1 to 2.4:1 in open sun (docs/brand/contrast-table.md) |
| Horizontal scroll | scrollWidth check | site at 390 and 1440 px, prototype, invite | None |

Not automated, and still to do on real phones (Sunday morning, SRS-A11Y-3): VoiceOver walkthrough of journey J3 (low vision) on an iPhone, recorded; largest Dynamic Type size on every P0 screen.

## Contrast

- Text uses only the role variables in 05-design-system.md; every role pair is in the brand contrast table.
- Body text: ink-900 on birch-100 15.24:1 (light, sun); birch-100 on dusk-900 13.97:1 (dark).
- Primary button label: birch-50 on maple-700 5.93:1; dark: ink-900 on maple-500 4.91:1.
- Gold is never used for text on light backgrounds (1.65:1).
- Paper grain darkens the background by at most about 9% (16% alpha tile at 0.55 opacity in sun mode); ink on the darkest grain pixel stays above 13:1.
- State is never shown by color alone: the flame changes shape (small flame, full flame with dot, dome, smoke); counts are text; ladder current step has a border and a hidden "(this is the plan)" label.

## Focus order (rules; measured order per state in the annex)

1. Top bar: Menu (camera only) → Close.
2. Content region (`<main tabindex="0">`, so keyboard users can scroll long content).
3. Interactive content in reading order (fields, choices, edit buttons, list rows).
4. Action area: primary button, then the text button.
5. Sheets (Bits UI Dialog): focus moves to the sheet title on open, is trapped inside, Escape closes, and focus returns to the control that opened it. In static screenshots sheets are rendered inline and are not trapped; the live components are.

## Screen reader labels

| Element | Accessible name or behavior |
| --- | --- |
| Shutter (H1) | "Take the photo" |
| Menu, Close | "Menu", "Close" |
| Invite photo (I1, H2, H3) | The 20-word spoken scene, for example "A pond with yellow trees and an empty bench." (SRS-ACC-5) |
| Invite words | The page's h1 on I1 |
| TypeWords (H2) | Announces the full six words once when complete (`aria-live="polite"`) |
| FlameMeter, NeedCount | `role="status"`: "Need 1 more." plus "1 in, 2 to go ahead. Nobody sees who." Dots are hidden |
| Flame states | `role="img"`: "Kindling", "Lit", "Ember", "Gone" |
| Compass | Spoken line in `aria-live`: "Fuego, 400 meters, slightly left." / "Fuego is straight ahead." The dial is hidden |
| Mic button | "Dictate" / "Stop dictation", `aria-pressed` |
| Edit buttons | "Edit where you'll be", "Edit step 2" |
| Ladder | Ordered list "Plan steps, biggest first"; the lit step adds "(this is the plan)" |
| Fix the map tag actions | Group "Review amenity"; Keep, Change, Remove with `aria-pressed` |
| Download progress (O8) | `role="progressbar"` with value and label |
| Offline banner | `role="status"` |
| Errors | `role="alert"` (send failed, deadline too close); field errors linked by `aria-describedby` and `aria-invalid` |

## Touch targets

- Every button, link and control is ≥ 44 × 44 CSS px (measured). Primary buttons are 56 px tall and full width; the shutter is 84 px; choice pills are 48 px tall and at least 56 px wide.
- Primary actions sit in the bottom 40% of the screen (thumb zone).

## Motion, sound, text size

- All durations come from tokens and drop to 0 with `prefers-reduced-motion` or `data-reduce-motion`: no flicker, no develop animation (the final print shows at once), no sparks, no word-by-word reveal.
- Sound respects the silent switch where the platform exposes it; every sound has a visual equivalent.
- Type is in rem; on iPhone the app opts into Dynamic Type (`html.dynamic-type` uses `-apple-system-body`). Layouts are single-column and wrap; no fixed-height text containers except the 56 px buttons, which grow with content.

## Known gaps

- Real-device VoiceOver and Dynamic Type passes are scheduled for Sunday morning on the four phones.
- Haptics: iOS Safari doesn't support `navigator.vibrate`; the compass "facing" tick falls back to a short tone (SRS-CMP-3).
