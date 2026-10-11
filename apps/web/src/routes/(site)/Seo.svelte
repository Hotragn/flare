<!-- Head tags for one website page: title, description, canonical, Open Graph, Twitter card,
     and on the home page the JSON-LD SoftwareApplication record. -->
<script lang="ts">
  import { t } from "#lib/copy/site.ts";
  import { ORIGIN, OG_IMAGE, ldJson, page, softwareApplication, type SitePage } from "./seo.ts";
  let { path }: { path: SitePage["path"] } = $props();
  const p = $derived(page(path));
  const url = $derived(`${ORIGIN}${path}`);
  const ld = $derived(path === "/" ? `<script type="application/ld+json">${ldJson(softwareApplication())}</` + "script>" : "");
</script>

<svelte:head>
  <title>{p.title}</title>
  <meta name="description" content={p.desc} />
  <link rel="canonical" href={url} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={t("app.name")} />
  <meta property="og:url" content={url} />
  <meta property="og:title" content={p.title} />
  <meta property="og:description" content={p.desc} />
  <meta property="og:image" content={`${ORIGIN}${OG_IMAGE.path}`} />
  <meta property="og:image:width" content={String(OG_IMAGE.width)} />
  <meta property="og:image:height" content={String(OG_IMAGE.height)} />
  <meta property="og:image:alt" content={t("og.site.imageAlt")} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={p.title} />
  <meta name="twitter:description" content={p.desc} />
  <meta name="twitter:image" content={`${ORIGIN}${OG_IMAGE.path}`} />
  <meta name="twitter:image:alt" content={t("og.site.imageAlt")} />
  {#if ld}{@html ld}{/if}
</svelte:head>
