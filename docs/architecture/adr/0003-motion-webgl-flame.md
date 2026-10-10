# ADR-0003: WebGL2 shader flame with a CSS fallback; sound on, mute remembered

Status: Accepted. Date: 2026-10-10. Founder decisions 1 and 2 (Oct 10).

## Context
The flame is the product's state signal (kindling, lit, ember, gone). Lab report 06 measured seven variants on an M4 at 1x and 4x CPU throttle.

## Decision
- Ship the brand-shaped WebGL2 shader flame (1.9 KB, 2.3% main thread) wherever the gates pass: WebGL2 present, `prefers-reduced-motion` not set, page visible, and the frame-time probe holding 50 fps or better over the first 60 frames. Otherwise the CSS flame (1.1 KB). DPR capped at 2. Paused when hidden.
- Shape carries the state first, colour second (design rule 3), so the fallback says the same thing.
- Sound on by default. Screens that make sound show a 44 px mute toggle (`SoundToggle.svelte`); the choice is kept on the device in `localStorage`. Haptics use the platform where available (iOS switch-overlay tick, `navigator.vibrate` on Android).

## Options weighed
| Option | Size | Why not |
| --- | --- | --- |
| Lottie | 41 KB | 20x the shader, still needs a fallback |
| Rive | 334 to 800 KB | Over the budget on its own; editor-only authoring |
| CSS only | 1.1 KB | Kept as the fallback; less depth |

## Open
The iPhone 13 frame rate is unmeasured. `/lab/fps` in the prototype runs on the phones Sunday; the gate above makes a slow phone fall back by itself.
