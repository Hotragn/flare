// One call per moment: the sound and the haptic that belong to it (motion.md, sections 3 to 6).
// The visual motion lives in the components; this adds what you hear and feel.
import { play } from "./sound.ts";
import { haptic } from "./haptics.ts";

export type Moment = "yes" | "lit" | "ember" | "facing" | "gone";

export function feedback(m: Moment, opts: { hapticAttached?: boolean } = {}) {
  switch (m) {
    case "yes": // small dry tick; the tap itself ticks where hapticTap is attached
      play("yes");
      if (!opts.hapticAttached) haptic("tap");
      return;
    case "lit": // low warm whump and one haptic (vibrate only; iOS cannot buzz without a tap)
      play("lit");
      haptic("success");
      return;
    case "ember": // soft low note, no haptic: nothing went wrong, it got smaller
      play("ember");
      return;
    case "facing": // SRS-CMP-3: a haptic where the phone can vibrate, a short tone where it can't
      if (haptic("facing") !== "vibrate") play("facing");
      return;
    case "gone": // silence, on purpose
      return;
  }
}
