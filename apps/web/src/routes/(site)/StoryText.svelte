<!-- The scroll story's words alone: what the prerendered page and a visitor without JavaScript
     see. Story.svelte (the animated scene with the same lines) replaces it when it comes near the
     screen, so its 10 KB of styles stay out of the first paint. -->
<script lang="ts">
  import { t, type CopyKey } from "#lib/copy/site.ts";
  const chapters: [CopyKey, CopyKey][] = [
    ["flame.kindling", "site.story.k"],
    ["flame.lit", "site.story.l"],
    ["flame.ember", "site.story.e"],
    ["flame.gone", "site.story.g"],
  ];
</script>

<h2 class="t-title">{t("site.story.title")}</h2>
<p class="lead">{t("site.story.lead")}</p>
<ol class="steps">
  {#each chapters as [name, line], i}
    <li>
      <h3 class="t-heading"><span class="n" aria-hidden="true">{i + 1}</span> {t(name)}</h3>
      <p>{t(line)}</p>
    </li>
  {/each}
</ol>
