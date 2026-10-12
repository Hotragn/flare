// A yes arrives as a spark (CountRing): a small warm light flies in from just outside a side edge
// of the screen, on a curve, into the flame at the ring's centre, then bursts as the flame takes it.
// Web Animations API; loaded on demand on the first yes that arrives while the screen is open.
// Resolves when the spark lands (640 ms), so the caller can grow the flame and tick the count then.
// No names, no faces: every spark looks the same.
const FLY_MS = 640;

export function fly(ring: HTMLElement, n: number, seed: number): Promise<void> {
  const r = ring.getBoundingClientRect();
  const box = ring.closest(".screen")?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    width: innerWidth,
    height: innerHeight,
  };
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let k = 0; k < Math.min(3, n); k++) {
    const left = (seed + k) % 2 === 0;
    const x = (left ? box.left - 16 : box.left + box.width + 16) - cx;
    const y = box.top + box.height * (0.12 + (((seed + k) * 37) % 30) / 100) - cy;
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "18px",
      height: "18px",
      margin: "-9px",
      borderRadius: "50%",
      pointerEvents: "none",
      background: "radial-gradient(circle, #fff6d8 0 30%, #f2b33d 55%, transparent 72%)",
      boxShadow: "0 0 14px 6px rgb(242 179 61 / 0.55)",
    });
    ring.append(el);
    // A quadratic curve that bows upward on the way in, sampled into keyframes.
    const bx = x * 0.35;
    const by = Math.min(y, 0) - 70;
    const frames = Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const u = 1 - t;
      const px = u * u * x + 2 * u * t * bx;
      const py = u * u * y + 2 * u * t * by;
      return { transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${(0.7 + 0.5 * t).toFixed(2)})` };
    });
    const delay = k * 120;
    el.animate(frames, { duration: FLY_MS, delay, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "backwards" });
    el.animate(
      [
        { transform: "scale(1.2)", opacity: 1 },
        { transform: "scale(3.2)", opacity: 0 },
      ],
      {
        duration: 420,
        delay: delay + FLY_MS,
        easing: "ease-out",
        fill: "forwards",
      },
    ).finished.then(
      () => el.remove(),
      () => el.remove(),
    );
  }
  return new Promise((done) => setTimeout(done, FLY_MS));
}
