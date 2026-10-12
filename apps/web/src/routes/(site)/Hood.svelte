<!-- "Under the hood" at the bottom of /how/ (brief item 6): the real path a photo takes, phone
     -> server -> relay -> laptop hub -> Gemma, with the cloud fallback and the deletion sweep
     beside the server. Each partner sits on the stop where it works, with one measured number
     and a link to the code. Motion: a light runs down the wires 3 times when the diagram comes
     into view, so the order of the path is the thing that moves. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/site.ts";
  import { play } from "./motion.ts";

  const REPO = "https://github.com/Hotragn/flare/blob/main/";
  type Partner = { name: string; line: CopyKey; path: string };
  type Stop = { id: string; node: CopyKey; partners: Partner[] };
  const path: Stop[] = [
    {
      id: "phone",
      node: "site.hood.n.phone",
      partners: [
        { name: "ElevenLabs", line: "site.hood.eleven", path: "scripts/gen-voice.ts" },
        { name: "Tinker", line: "site.hood.tinker", path: "docs/ml/model-card-conditions-lora.md" },
      ],
    },
    {
      id: "server",
      node: "site.hood.n.server",
      partners: [
        { name: "Telegram", line: "site.hood.telegram", path: "apps/server/src/telegram/render.ts" },
        { name: "Mastra", line: "site.hood.mastra", path: "apps/server/src/agent/ladder-agent.ts" },
        { name: "Sentry", line: "site.hood.sentry", path: "apps/server/test/tracing.test.ts" },
      ],
    },
    { id: "relay", node: "site.hood.n.relay", partners: [{ name: "WebSocket", line: "site.hood.relay", path: "apps/server/src/hub/relay.ts" }] },
    { id: "hub", node: "site.hood.n.hub", partners: [{ name: "Gemma 4 E4B", line: "site.hood.gemma", path: "apps/hub/src/ollama.ts" }] },
  ];
  const side: Stop[] = [
    {
      id: "cloud",
      node: "site.hood.n.cloud",
      partners: [
        { name: "Google AI Studio", line: "site.hood.google", path: "apps/server/src/cloud.ts" },
        { name: "DigitalOcean", line: "site.hood.do", path: "apps/server/src/cloud.ts" },
      ],
    },
    { id: "sweep", node: "site.hood.n.sweep", partners: [{ name: "SQLite", line: "site.hood.sweep", path: "apps/server/src/core/sweep.ts" }] },
  ];
  const entire: Partner = { name: "Entire", line: "site.hood.entire", path: ".entire/settings.json" };
</script>

{#snippet partner(p: Partner)}
  <li class="partner">
    <b>{p.name}</b>
    <span>{t(p.line)}</span>
    <a href={REPO + p.path} rel="noopener noreferrer">{t("site.hood.code", { path: p.path })}</a>
  </li>
{/snippet}

<h2 class="t-title" id="hood">{t("site.hood.title")}</h2>
<p class="lead">{t("site.hood.lead")}</p>

<div class="hood" use:play={{ margin: "0px 0px -25% 0px" }}>
  <p class="sr-only">{t("site.hood.aria")}</p>
  <ol class="path">
    {#each path as s, i}
      <li class="stop s-{s.id}" style:--i={i}>
        {#if i > 0}<span class="wire" aria-hidden="true"><span class="pulse"></span></span>{/if}
        <h3 class="node">{t(s.node)}</h3>
        <ul class="partners">{#each s.partners as p}{@render partner(p)}{/each}</ul>
      </li>
    {/each}
  </ol>
  <div class="side">
    {#each side as s, i}
      <section class="stop branch b-{s.id}" style:--i={i}>
        <span class="wire" aria-hidden="true"><span class="pulse"></span></span>
        <h3 class="node">{t(s.node)}</h3>
        <ul class="partners">{#each s.partners as p}{@render partner(p)}{/each}</ul>
      </section>
    {/each}
    <ul class="partners every">{@render partner(entire)}</ul>
  </div>
</div>

<style>
  .lead { margin: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .hood { display: grid; gap: 20px; }
  .path, .partners { list-style: none; margin: 0; padding: 0; }
  .path { display: flex; flex-direction: column; }
  .stop { position: relative; display: flex; flex-direction: column; gap: 8px; }
  .node { margin: 0; align-self: flex-start; padding: 8px 16px; border-radius: 999px; background: var(--c-dusk-900); color: var(--c-gold-300); font-size: 1.05rem; }
  .s-hub .node { background: var(--c-pine-700); color: var(--c-birch-50); }
  .partners { display: grid; gap: 8px; }
  .partner { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface); }
  .partner b { font-size: 1.05rem; }
  .partner a { min-height: 44px; display: inline-flex; align-items: center; font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.9rem; overflow-wrap: anywhere; }
  .side { display: flex; flex-direction: column; gap: 0; }
  .every { margin-top: 18px; }

  /* Wires: a vertical line from the stop above, with a light that runs down it. */
  .wire { position: relative; display: block; width: 4px; height: 36px; margin-left: 22px; background: var(--line); border-radius: 2px; overflow: hidden; }
  .pulse { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform: translateY(-100%);
    background: linear-gradient(transparent, var(--c-gold-400) 70%, #E2622A); }
  :global(.armed.play) .pulse { animation: run 1.2s var(--ease-in-out, ease-in-out) calc(var(--i) * 300ms) 3; }
  .branch .pulse { background: linear-gradient(transparent, #8DB6C4 70%, var(--c-pine-500)); }
  @keyframes run { from { transform: translateY(-100%); } to { transform: translateY(100%); } }

  @media (min-width: 900px) {
    .hood { grid-template-columns: 1.4fr 1fr; gap: 40px; align-items: start; }
    .side { padding-top: 110px; }
  }
</style>
