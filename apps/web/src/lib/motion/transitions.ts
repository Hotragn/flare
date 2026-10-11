// Page and step transitions on the View Transitions API, with a graceful fallback.
// - Where document.startViewTransition exists: the old page fades out and drops 8 px
//   (160 ms, ease-in) while the new one fades in and rises 12 px (240 ms, ease-out).
// - Reduced motion: the same API, but a 160 ms crossfade with no movement.
// - No API (older iOS): the page swaps at once. Nothing waits, nothing breaks.
// Styles: transitions.css (imported by the root layout).
import { reducedMotion } from "./core.ts";
import "./transitions.css";

type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

function mark(kind: "page" | "step") {
  const html = document.documentElement;
  html.dataset.vt = reducedMotion() ? "fade" : kind;
  return () => {
    delete html.dataset.vt;
  };
}

/** For SvelteKit onNavigate: resolves when the browser has captured the old page. */
export function pageTransition(complete: () => Promise<void>): Promise<void> | void {
  const d = document as VTDoc;
  const start = d.startViewTransition?.bind(d);
  if (!start) return;
  const done = mark("page");
  return new Promise((resolve) => {
    const vt = start(async () => {
      resolve();
      await complete();
    });
    vt.finished.finally(done);
  });
}

/** For changes inside one page (prototype steps): runs update inside a view transition. */
export function stepTransition(update: () => void | Promise<void>) {
  const d = document as VTDoc;
  if (typeof document === "undefined" || !d.startViewTransition) {
    update();
    return;
  }
  const done = mark("step");
  d.startViewTransition(update).finished.finally(done);
}
