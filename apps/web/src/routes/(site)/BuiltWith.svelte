<!-- W1 "Built with" (backlog #14): each tool and what it does in Flare, in one line. Plain links,
     no logos fetched from other sites. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/site.ts";
  const tools: [string, string, CopyKey][] = [
    ["Gemma 4", "https://ai.google.dev/gemma", "site.built.gemma"],
    ["Google AI Studio", "https://aistudio.google.com/", "site.built.google"],
    ["DigitalOcean", "https://www.digitalocean.com/", "site.built.do"],
    ["ElevenLabs", "https://elevenlabs.io/", "site.built.eleven"],
    ["Sentry", "https://sentry.io/", "site.built.sentry"],
    ["Mastra", "https://mastra.ai/", "site.built.mastra"],
    ["OpenStreetMap", "https://www.openstreetmap.org/copyright", "site.built.osm"],
    ["Render", "https://render.com/", "site.built.render"],
    ["SvelteKit", "https://svelte.dev/docs/kit", "site.built.sveltekit"],
  ];
</script>

<h2 class="t-title">{t("site.built.title")}</h2>
<ul class="built">
  {#each tools as [name, href, line]}
    <li><a {href} rel="noopener noreferrer">{name}</a><span>{t(line)}</span></li>
  {/each}
</ul>

<style>
  .built { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
  .built li { display: grid; gap: 2px; padding: 12px 14px; border-radius: 16px; border: 1.5px solid var(--line); }
  .built a { font-weight: 800; display: inline-flex; align-items: center; min-height: 44px; align-self: flex-start; }
  @media (min-width: 700px) { .built { grid-template-columns: repeat(3, 1fr); } }
</style>
