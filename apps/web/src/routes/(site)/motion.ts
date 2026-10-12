// Website motion helpers (brief: motion explains one idea, never decoration).
// - stillMotion(): reduced motion from the OS or from the app's own setting.
// - play: arms a section's CSS entrance and starts it once it is in view. Without JavaScript,
//   or with reduced motion, nothing is armed and the CSS shows the finished state.
// - story: drives the home scroll story. Chrome and Safari 26 scrub it with a native scroll
//   timeline (CSS only); other browsers get the same keyframes, paused, with a negative delay set
//   from scroll position once per frame. Reduced motion steps through the four chapters with no
//   in-between frames. The chapter (0 to 3) is always written to data-ch for the dots.

export const stillMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");

export function play(node: HTMLElement, opts: { margin?: string } = {}) {
  if (stillMotion() || !("IntersectionObserver" in window)) return;
  node.classList.add("armed");
  const io = new IntersectionObserver(
    (es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      node.classList.add("play");
      io.disconnect();
    },
    { rootMargin: opts.margin ?? "0px 0px -15% 0px" },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}

export const scrollTimelines = () =>
  typeof CSS !== "undefined" &&
  CSS.supports("animation-timeline: view()") &&
  CSS.supports("animation-range: contain 0% contain 100%");

/** Progress through a tall section while its sticky stage is pinned: 0 at its top, 1 at its end. */
export function progressOf(top: number, height: number, viewport: number): number {
  const run = height - viewport;
  if (run <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / run));
}

export const chapterOf = (p: number, n = 4) => Math.min(n - 1, Math.floor(p * n));

export function story(node: HTMLElement) {
  const still = stillMotion();
  const native = !still && scrollTimelines();
  node.dataset.mode = still ? "still" : native ? "native" : "frames";
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = node.getBoundingClientRect();
    const p = progressOf(r.top, r.height, innerHeight);
    const ch = chapterOf(p);
    if (node.dataset.ch !== String(ch)) node.dataset.ch = String(ch);
    // Native: the scroll timeline drives the frames. Still: the middle of each chapter.
    if (!native) node.style.setProperty("--p", String(still ? (ch + 0.5) / 4 : p));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  return {
    destroy() {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    },
  };
}
