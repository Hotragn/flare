<!-- /how/ in full (fresh-eyes #18): the real demo screens in order, one line each, then Try the demo. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/index.ts";
  const steps = ["send", "friend", "count", "lit", "find", "after"] as const;
</script>

<h1 class="t-title">{t("site.walk.title")}</h1>
<p class="lead">{t("site.walk.lead")}</p>
<ol class="walk">
  {#each steps as s, i}
    {@const title = t(`site.walk.${s}.t` as CopyKey)}
    <li>
      <img src="/site/how/{s}.webp" srcset="/site/how/{s}-240.webp 240w, /site/how/{s}.webp 400w" sizes="(min-width: 900px) 240px, 120px" width="260" height="563" loading={i < 1 ? "eager" : "lazy"} decoding="async" alt={t("site.walk.alt", { step: title })} />
      <div>
        <h2 class="t-heading"><span class="n" aria-hidden="true">{i + 1}</span> {title}</h2>
        <p>{t(`site.walk.${s}.b` as CopyKey)}</p>
      </div>
    </li>
  {/each}
</ol>
<p class="try"><a class="open" href="/app/demo/">{t("site.walk.try")}</a></p>

<style>
  .lead { margin: 4px 0 20px; }
  /* Phones: a small screen beside its line, easy to scan; desktops: three big columns. */
  .walk { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; }
  .walk li { display: grid; grid-template-columns: 120px 1fr; gap: 16px; align-items: center; }
  .walk img { width: 120px; height: auto; border-radius: 16px; box-shadow: 0 8px 22px rgb(0 0 0 / 0.18); background: #1b1512; }
  .walk h2, .walk p { margin: 0; }
  .walk p { max-width: 34ch; margin-top: 6px; }
  .n { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--c-maple-700); color: var(--c-birch-50); font-size: 0.95rem; margin-right: 4px; }
  .try { margin: 32px 0 0; text-align: center; }
  .open { display: inline-flex; min-height: 52px; align-items: center; padding: 0 26px; border-radius: 999px; background: var(--c-maple-700); color: var(--c-birch-50); font-weight: 700; text-decoration: none; }
  @media (min-width: 900px) {
    .walk { grid-template-columns: repeat(3, 1fr); gap: 40px 28px; }
    .walk li { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .walk img { width: 240px; border-radius: 26px; }
  }
</style>
