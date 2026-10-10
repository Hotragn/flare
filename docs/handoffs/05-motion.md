# Handoff 05: Motion and sound to the Architect

From: Motion and sound designer. Date: Sat 2026-10-10. Next role: Architect (engineering lead), then the Sunday iPhone check.

## What was delivered

| Path | Contents |
| --- | --- |
| docs/design/motion.md | The full spec: principles, tokens, the flame, 10 micro-interactions, reduced motion, sound, haptics, Sunday test plan, measurements |
| design/system/build-tokens.mjs → tokens.css, tokens.json | Motion tokens: 11 durations, 6 easings, 2 springs (with CSS `linear()` curves); reduced motion zeroes everything except `--dur-fade` |
| src/lib/motion/ | `core.ts` (tokens in JS, easings, reduced-motion check, Kindling steps), `flame-shader.ts` + `flame-gl.ts` (WebGL flame), `sound.ts`, `haptics.ts`, `feedback.ts` (one call per moment), `speech.ts` (SRS-CMP-2 cadence), `transitions.ts/.css` (View Transitions), `meter.ts` (frame meter) |
| src/lib/components/ | Flame (shader with CSS/SVG fallback), FlameMeter (count tick), Hearth (intro, spark timing), Compass (spring needle, lock-on, tick, speech), PhotoPrint (opacity-only develop), TypeWords (`delay`), Button (press, `haptic`), Sheet (exit animation, drag to dismiss) |
| src/routes/+layout.svelte | Page transitions via `onNavigate`, audio start on first gesture, in-app reduce-motion setting |
| src/routes/proto/+page.svelte | Step transitions, sound and haptic per moment, sound toggle |
| src/routes/lab/ | `/lab/fps`, `/lab/haptics`, `/lab/motion` test pages for Sunday |
| static/sounds/ | yes.wav, lit.m4a (+ .wav), ember.m4a (+ .wav), facing.wav: original, synthesized |
| design/motion/ | make-sounds.mjs (sound generator), bench.mjs, shots.mjs, sequence.mjs, contact.mjs, check-vt.mjs, check-audio.mjs, axe-lab.mjs, js-weight.mjs, sounds.json, results/bench.json |
| docs/BUGLOG.md | BUG-009 to BUG-014 |

## Key decisions and why

1. **WebGL flame, redrawn on the brand mark.** The lab's shader is a noise teardrop with no hole. Ours samples a mask texture built from the brand paths, so the pin-flame and its round hole are exact. Noise bends only the part above the hole. It matches the lab's frame rate with 43% less GPU-process CPU for 2.45 times the pixels. The cost is 3.6 KB brotli, loaded lazily.
2. **The SVG is always there first.** It is the server render, the export, the screen-reader image and the fallback. The shader starts only if WebGL works, motion is allowed, the flame is 72 px or larger, and fewer than 4 shader flames are live. It pauses off screen and drops to DPR 1, then to CSS, if frames run late.
3. **The photo never waits on the hub.** The develop is a fixed 2.4 s (opacity layers only, no blur); the words follow the hub, never before 1,440 ms.
4. **Reduced motion is a design.** No movement, but every change still shows as a 160 ms crossfade. With reduced motion the shader never loads.
5. **Sounds are ours.** 4 sounds synthesized by a seeded script (byte-identical re-runs), 24.5 KB in total, fetched only after the first tap. Ambient audio session, so the silent switch mutes them. Gone is silent.
6. **Haptics are honest.** Since iOS 26.5, scripts can't fire the switch haptic (ios-haptics README; tappt PR #5). So the yes button carries a transparent switch label that the finger itself taps. Android uses `navigator.vibrate`. Everything else gets sound and visuals. A Lit caused by a friend gives no haptic on iOS.

## Measurements (desktop; details in motion.md sections 2 and 8)

- Flame, M4 + Chrome 154, CDP CPU throttle 1x, 4x and 6x: 60 fps, p95 16.7 to 16.8 ms, 0 dropped frames in all 14 runs, including 4 shader flames at 6x.
- Shader JS per frame: 0.003 to 0.028 ms.
- GPU-process CPU: 6.2% (WebGL) vs 2.5% (CSS) at 1x.
- One-time mask build: 17 ms at 1x, 57 to 87 ms at 4x and 6x.
- Bytes: GLSL 954 B brotli (1,005 B gzip); lazy WebGL chunk 3,626 B brotli (3,984 B gzip); sounds 24,505 B.
- JS weight (gzip): invite I1 61.6 KB (was 51.1 KB), 56.7 KB with reduced motion; website 57.9 KB (was 48.4 KB). Budget 150 KB.
- `npm run check`: 0 errors, 0 warnings. `npm run build`: written. axe: 193 targets, 0 violations, plus 8 /lab views with 0. Focus audit: 0 targets under 44 px. View transitions: 1 per navigation, crossfade under reduced motion.

## What the architect must know

- **Imports:** `#lib/motion/*.ts`. Use `feedback("yes" | "lit" | "ember" | "facing" | "gone")` when a real state change arrives. The flame takes `state` and `progress` (`kindlingProgress(have, quorum)`); change props and it animates. Don't remount it.
- **Real tap on Lit:** call `feedback("lit")` from the event that made it Lit. If that was this user's own tap, the tap already ticked.
- **Compass:** pass `cues` (tick or tone on lock) and `speak` (speech cadence). Feed it bearing and meters; the lock hysteresis is inside.
- **Sound:** `installAudioStart()` is in the root layout. Don't create other AudioContexts. Mute lives in `localStorage["flare.sound"]`; haptics off in `localStorage["flare.haptics"]`; reduce motion in `localStorage["flare.motion"]`. Settings UI for these three is not designed yet.
- **WebGL limit:** max 4 live shader flames per page (`MAX_LIVE` in flame-gl.ts). More flames fall back to CSS automatically.
- **Exports stay deterministic:** export, a11y and focus scripts load with `reduce=1`, so they always render the SVG.
- **Port:** export.mjs, a11y.mjs and focus-audit.mjs read `PORT` (default 5318). A fresh worktree needs `mkdir -p design/exports` before a11y.mjs (BUG-013).
- **Files outside this role touched, markup only, no text:**
  - `.gitignore` (`lab/` to `/lab/`, BUG-009);
  - `Screen.svelte` (one `svelte-ignore` comment, BUG-013);
  - `I4YoureIn.svelte` (`intro` on the Hearth, on a line with no text).
  The UX writer's branch may touch I4; the merge should be trivial.
- **Not done here:**
  - NeedCount.svelte (H5) has no count tick; it is not in this role's files. Copy the `.tick` and `.pop` classes from FlameMeter.
  - docs/design/05-design-system.md still lists the old 6 motion tokens; it should point to motion.md section 1.

## Unverified until Sunday's iPhone check

- Flame frame rate, p95 and look on iPhone 13 (A15) and the Pros. CPU throttling does not slow the GPU, so desktop numbers can't predict this. Pass: p95 at or under 20 ms at 60 Hz.
- 120 Hz on the Pros. It needs the Safari feature flag off; expect 60 Hz by default.
- Low Power Mode at 30 fps: the flame should not auto-downgrade.
- Mask build time on the A15. If there is a visible hitch at page load, ship a pre-made mask PNG.
- **Every haptic path:** the real switch, the overlay on 26.5+, the script click on 26.4 and earlier, and whether System Haptics off disables them.
- The silent switch muting the sounds (ambient session), and Safari's AAC decode timing.
- Speech with the screen locked (SRS-CMP-7).
- View Transitions in Safari 18+ on the phones (checked in Chrome only).

## Needs the founder's decision

1. **JS weight:** motion adds 10.5 KB gzip to the invite page (61.6 KB, budget 150 KB). Keep it, or cut the shader on the invite page and use it only on Lit and host screens?
2. **Sound on by default?** The spec has sound on, after the first tap, muted by the silent switch. The alternative is off by default, with a toggle.

## Change requests

None against earlier phases.
