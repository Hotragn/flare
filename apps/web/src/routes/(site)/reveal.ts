// Section entrance on scroll: a 12 px rise with a fade, once (docs/design/motion.md tokens:
// --dur-base and --ease-out). Content is visible without JavaScript and with reduced motion;
// the class that hides it is only added when this runs and motion is allowed.
export function reveal(node: HTMLElement) {
  const reduce =
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-reduce-motion");
  if (reduce || !("IntersectionObserver" in window)) return;
  const r = node.getBoundingClientRect();
  if (r.top < innerHeight) return; // already on screen: never hide what the person can see
  node.classList.add("reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        node.classList.add("in");
        io.disconnect();
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
