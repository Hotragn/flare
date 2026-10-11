<!-- W1 feature cards (backlog #14): one card per feature that exists today, each with a small
     real screen from the app and a way into the demo. Features still being built get no card. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/site.ts";
  // The screens load when the cards come within 400 px, not with the page: Chrome's own lazy
  // margin on phones is a whole screen or more, and they would compete with the hero (LCP).
  function near(img: HTMLImageElement) {
    const go = () => {
      img.src = img.dataset.src ?? "";
    };
    if (typeof IntersectionObserver === "undefined") return go();
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          go();
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(img);
    return { destroy: () => io.disconnect() };
  }
  const cards = ["count", "shrink", "friend", "plan", "compass", "loop", "crew", "spark", "telegram", "gone"] as const;
</script>

<h2 class="t-title">{t("site.feat.title")}</h2>
<ul class="cards">
  {#each cards as c}
    {@const title = t(`site.feat.${c}.t` as CopyKey)}
    <li class="card">
      <img use:near data-src="/site/feat/{c}.webp" width="120" height="180" decoding="async" alt={t("site.feat.alt", { title })} />
      <div class="txt">
        <h3>{title}</h3>
        <p>{t(`site.feat.${c}.b` as CopyKey)}</p>
      </div>
    </li>
  {/each}
</ul>
<p class="try"><a class="go" href="/app/demo/">{t("demo.try")}</a></p>

<style>
  .cards { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 14px; }
  .card { display: grid; grid-template-columns: 96px 1fr; gap: 14px; align-items: center; padding: 12px; border-radius: 22px;
    background: linear-gradient(160deg, #f3ead9, #e5efe3); box-shadow: 0 6px 18px rgb(22 35 58 / 0.08); }
  .card img { width: 96px; height: 144px; object-fit: cover; border-radius: 14px; background: #1b1512; }
  .txt h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #1d2b1f; }
  .txt p { margin: 4px 0 0; color: #33402f; }
  .try { margin: 22px 0 0; text-align: center; }
  .go { display: inline-flex; min-height: 52px; align-items: center; padding: 0 26px; border-radius: 999px; background: var(--c-maple-700); color: var(--c-birch-50) !important; font-weight: 700; text-decoration: none; }
  @media (min-width: 700px) { .cards { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1100px) { .cards { grid-template-columns: repeat(3, 1fr); } }
</style>
