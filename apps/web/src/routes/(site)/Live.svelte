<!-- "Running now" (brief item 3): live proof with no personal data. Gemma on our laptop
     (health.hub), and records past their end from the deletion audit, with how long ago it ran.
     Asks after the page has painted, so it never slows the first screen. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "#lib/copy/site.ts";
  import { fetchAudit, type AuditView } from "./audit.ts";
  import { agoParts, fetchHealth, type HealthView } from "./live.ts";

  let health: HealthView | null = $state(null);
  let audit: AuditView | null = $state(null);
  let now = $state(new Date());

  onMount(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    const go = () => {
      fetchHealth(fetch).then((h) => (health = h));
      fetchAudit(fetch).then((a) => (audit = a));
      tick = setInterval(() => (now = new Date()), 1000);
    };
    const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(go, { timeout: 2500 }) : setTimeout(go, 1200);
    return () => {
      clearInterval(tick);
      if (!idle) clearTimeout(handle as ReturnType<typeof setTimeout>);
    };
  });

  const auditLine = $derived.by(() => {
    if (audit?.s !== "ok") return "";
    const a = agoParts(audit.at, now);
    return "s" in a ? t("site.live.audit", { n: audit.leftover, s: a.s }) : t("site.live.auditMin", { n: audit.leftover, m: a.m });
  });
</script>

<div class="live">
  <h2 class="t-heading">{t("site.live.title")}</h2>
  <ul aria-live="polite">
    <li class:on={health?.s === "ok" && health.hub === "connected"} class:warn={health?.s === "ok" && health.hub === "absent"} class:off={health?.s === "down"}>
      <span class="dot" aria-hidden="true"></span>
      <span>
        {#if health === null}{t("site.live.checking")}
        {:else if health.s === "down"}{t("site.live.down")}
        {:else if health.hub === "connected"}{t("site.live.on")}
        {:else}{t("site.live.off")}{/if}
      </span>
    </li>
    <li class:on={audit?.s === "ok" && audit.pass} class:warn={audit?.s === "ok" && !audit.pass} class:off={audit?.s === "down"}>
      <span class="dot" aria-hidden="true"></span>
      <span>{audit === null ? t("site.live.checking") : audit.s === "down" ? t("site.live.down") : auditLine}</span>
    </li>
  </ul>
  <p class="note">
    {t("site.live.note")}
    {#if health?.s === "ok"}{t("site.live.build", { v: health.version.slice(0, 7) })}.{/if}
  </p>
  <p class="more"><a href="/privacy/">{t("site.live.more")}</a></p>
</div>

<style>
  .live { border-radius: var(--r-lg); padding: 18px 20px; background: var(--c-dusk-900); color: var(--c-birch-100); display: flex; flex-direction: column; gap: 10px; }
  .live h2 { margin: 0; color: var(--c-gold-300); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 1rem; }
  li { display: flex; gap: 10px; align-items: center; min-height: 28px; }
  .dot { position: relative; width: 12px; height: 12px; border-radius: 50%; background: #8a93a3; flex: none; }
  .on .dot { background: #5FCB8A; }
  .on .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #5FCB8A; animation: beat 2.4s var(--ease-out) infinite; }
  .warn .dot { background: var(--c-gold-400); }
  .off .dot { background: #E2622A; }
  .note { margin: 0; font-size: 0.95rem; }
  .more { margin: 0; font-weight: 700; }
  .more a { color: var(--c-gold-300) !important; min-height: 44px; display: inline-flex; align-items: center; }
  @keyframes beat { 0% { opacity: 0.6; transform: scale(1); } 70%, 100% { opacity: 0; transform: scale(2.6); } }
  @media (prefers-reduced-motion: reduce) { .on .dot::after { animation: none; opacity: 0; } }
</style>
