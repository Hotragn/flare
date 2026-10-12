// Ambient motion (rain, swaying trees, drifting Sparks) runs only while someone can see it:
// this Svelte action sets data-paused on the node when it scrolls out of view or the page is
// hidden; each component's CSS pauses its animations under [data-paused].
export function ambient(node: Element) {
  let seen = true;
  const set = () => node.toggleAttribute("data-paused", !seen || document.hidden);
  const io =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((e) => {
          seen = e.some((x) => x.isIntersecting);
          set();
        });
  io?.observe(node);
  document.addEventListener("visibilitychange", set);
  set();
  return {
    destroy() {
      io?.disconnect();
      document.removeEventListener("visibilitychange", set);
    },
  };
}
