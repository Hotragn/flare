<!-- On a wide screen, beside the phone column: "Made for your phone" and a QR code to open this
     page there (fresh-eyes round 4). The QR is drawn on this computer (uqr, loaded only on wide
     screens); nothing is sent. A link page keeps its #key so the phone can open it. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "#lib/copy/index.ts";
  let svg = $state("");
  onMount(() => {
    const wide = matchMedia("(min-width: 1000px)");
    const draw = async () => {
      if (!wide.matches || svg) return;
      const { renderSVG } = await import("uqr");
      const url = location.pathname.startsWith("/g/") ? location.href : location.origin + location.pathname;
      svg = renderSVG(url, { border: 1, ecc: "M" });
    };
    void draw();
    wide.addEventListener("change", draw);
    return () => wide.removeEventListener("change", draw);
  });
</script>

{#if svg}
  <aside class="desk" aria-label={t("desk.title")}>
    <p class="t">{t("desk.title")}</p>
    <div class="qr" role="img" aria-label={t("desk.qrAlt")}>{@html svg}</div>
    <p class="b">{t("desk.body")}</p>
  </aside>
{/if}

<style>
  .desk { position: fixed; left: calc(50% - 240px - 260px); top: 50%; transform: translateY(-50%); width: 220px; display: flex; flex-direction: column; gap: 10px; color: #f3ead9; font-family: system-ui, sans-serif; }
  .t { margin: 0; font-weight: 800; font-size: 1.25rem; }
  .b { margin: 0; opacity: 0.85; }
  .qr { background: #fff; border-radius: 14px; padding: 10px; width: 180px; }
  .qr :global(svg) { width: 100%; height: auto; display: block; }
  @media (max-width: 999px) { .desk { display: none; } }
</style>
