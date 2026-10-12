<!-- Website frame (W0 nav, W7 footer) for /, /how/, /privacy/, /accessibility/, /run/.
     Mobile first, two columns from 900 px (docs/design/06-website.md). -->
<script lang="ts">
  import "#lib/styles/app.css";
  import "./site.css";
  import "./pill.css";
  import { page } from "$app/state";
  import { t } from "#lib/copy/site.ts";
  import { onDestroy } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { version } from "$app/env";
  let { children } = $props();

  // Website flames use the CSS renderer (Flame.svelte's "forced css"): same look and motion,
  // no WebGL on the main thread while a visitor reads. Set before the pages' flames mount,
  // cleared when the visitor moves on to the app.
  const browser = typeof document !== "undefined";
  if (browser) document.documentElement.dataset.flame = "css";
  onDestroy(() => {
    if (browser) delete document.documentElement.dataset.flame;
  });

  // View Transitions between the five site pages: the old page cross-fades into the new one
  // (Chrome, Safari 18+). Skipped with reduced motion, into the app, and where unsupported.
  onNavigate((nav) => {
    const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }).startViewTransition;
    if (!start || !nav.to?.route.id?.startsWith("/(site)") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return new Promise<void>((resolve) => {
      start.call(document, async () => {
        resolve();
        await nav.complete;
      });
    });
  });

  const links = [
    { href: "/how/", label: t("site.nav.how") },
    { href: "/privacy/", label: t("site.nav.privacy") },
    { href: "/accessibility/", label: t("site.nav.access") },
    { href: "/run/", label: t("site.nav.run") },
  ];
  const current = (href: string) => (page.url.pathname === href ? "page" : undefined);
</script>

<svelte:head>
</svelte:head>

<div class="site" data-theme="light">
  <a class="skip" href="#main">{t("site.nav.skip")}</a>
  <header class="nav">
    <a href="/" class="brand" aria-label={t("site.nav.home")} aria-current={current("/")}>
      <img src="/brand/flare-lockup-horizontal-light.svg" alt={t("app.name")} width="120" height="44" />
    </a>
    <nav aria-label={t("site.nav.aria")}>
      {#each links as l}<a href={l.href} aria-current={current(l.href)}>{l.label}</a>{/each}
    </nav>
    <a class="open" href="/app/">{t("site.nav.open")}</a>
  </header>

  <main id="main" tabindex="-1">
    {@render children()}
  </main>

  <footer class="foot">
    <nav aria-label={t("site.nav.footAria")} class="foot-nav">
      {#each links as l}<a href={l.href} aria-current={current(l.href)}>{l.label}</a>{/each}
    </nav>
    <div class="foot-line">
      <img src="/brand/flare-mark-maple.svg" alt="" width="36" height="36" />
      <p>{t("site.foot.made")} {t("site.foot.osm")}</p>
    </div>
    <p class="build">{t("site.foot.build", { id: version.slice(0, 12) })}</p>
  </footer>
</div>

<style>
  /* The nav stays put while the page under it cross-fades. */
  .nav { view-transition-name: site-nav; }
  .build { margin: 8px 0 0; font-size: 0.75rem; opacity: 0.75; }
</style>
