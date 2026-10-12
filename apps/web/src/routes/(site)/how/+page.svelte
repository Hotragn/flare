<!-- How it works in full: the real screens step by step (fresh-eyes #18), the shrink rule (W3), and the Gemma attribution (docs/ml/model-selection.md). -->
<script lang="ts">
  import { t } from "#lib/copy/site.ts";
  import Seo from "../Seo.svelte";
  import Walkthrough from "../Walkthrough.svelte";
  import Shrink from "../Shrink.svelte";
  import Hood from "../Hood.svelte";
  import { reveal } from "../reveal.ts";

  // The deck holds the exact license sentence; the terms address inside it becomes a link.
  const TERMS = "ai.google.dev/gemma/terms";
  const [before, after = ""] = t("site.how.gemma").split(TERMS);
</script>

<Seo path="/how/" />

<section class="band">
  <Walkthrough />
</section>

<section class="band alt" use:reveal>
  <Shrink />
</section>

<section class="band">
  <Hood />
</section>

<section class="band">
  <p class="t-small">{before}<a href={`https://${TERMS}`}>{TERMS}</a>{after}</p>
</section>
