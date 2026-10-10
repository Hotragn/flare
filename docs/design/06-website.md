# Flare: Website design

One scroll, mobile first, two columns from 900 px. Code: `design/prototype/src/routes/site/+page.svelte`. Exports: [site-mobile.png](../../design/exports/pages/site-mobile.png) (390 px, full page), [site-desktop.png](../../design/exports/pages/site-desktop.png) (1440 px). JavaScript: 48.5 KB gzipped (measured Oct 10). No horizontal scroll at 390 or 1440 px (scrollWidth equals viewport). axe-core: 0 violations on both widths.

| Section | Id | Content | Design |
| --- | --- | --- | --- |
| W0 Nav | `header` | Lockup; links: How it works, Privacy, Accessibility, Run it | Sticky; links hidden under 900 px (the page is short enough to scroll) |
| W1 Hero | `#top` | Kicker "Flare, for getting friends outside"; h1 "If enough friends say yes, it's on."; lead; buttons "Try the prototype", "See how"; "Seconds of screen. An hour outside." | Golden-hour scene full-bleed (same art as the DEV cover); copy on a dusk panel (78% opacity desktop, gradient on mobile) so birch text stays ≥ 7:1 |
| W2 How it works | `#how` | 3 steps: Snap where you are · Friends say yes, in private · It's lit. Go. | Print, FlameMeter, Lit flame as the three illustrations; numbered maple chips |
| W3 Shrink | (band) | Kindling, Lit, Ember, Gone with one line each; the Plan ladder in one sentence | Four state marks in a row (2 × 2 on mobile) |
| W4 Privacy | `#privacy` | Five promises; deletion audit block; honest limits | Audit block in dusk with monospace output; filled with the real audit output after the field test |
| W5 Accessibility | `#access` | Access line, needs, talking compass, spoken scene, Bench to Bench; WCAG 2.2 AA target; why benches (Netspar 60% to 75%; CDC 12.2% and 5.5%) | Icon list + statement |
| W6 Run it yourself | `#run` | Clone, pull gemma4:e4b, run | Code block; repo link `github.com/Hotragn/flare-outside` goes live when the founder makes the repo public |
| W7 Footer | `footer` | Made for DEV Hacktoberfest Week 1; "Map data © OpenStreetMap contributors" | Mark + one line |

Open items owned by later roles (not design gaps): the audit output (after the Sunday test), the public repo link (founder's yes), the deploy (founder's yes).
