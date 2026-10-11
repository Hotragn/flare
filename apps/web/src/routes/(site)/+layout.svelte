<!-- Website frame (W0 nav, W7 footer) for /, /how/, /privacy/, /accessibility/, /run/.
     Mobile first, two columns from 900 px (docs/design/06-website.md). -->
<script lang="ts">
  import "#lib/styles/app.css";
  import "./site.css";
  import { page } from "$app/state";
  import { t } from "#lib/copy/index.ts";
  let { children } = $props();

  const links = [
    { href: "/how/", label: t("site.nav.how") },
    { href: "/privacy/", label: t("site.nav.privacy") },
    { href: "/accessibility/", label: t("site.nav.access") },
    { href: "/run/", label: t("site.nav.run") },
  ];
  const current = (href: string) => (page.url.pathname === href ? "page" : undefined);
</script>

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
  </footer>
</div>
