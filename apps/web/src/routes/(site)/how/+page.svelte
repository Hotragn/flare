<!-- How it works (W2 and W3 in full), with the Gemma attribution (docs/ml/model-selection.md). -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Seo from "../Seo.svelte";
  import Steps from "../Steps.svelte";
  import Shrink from "../Shrink.svelte";
  import { reveal } from "../reveal.ts";

  // The deck holds the exact license sentence; the terms address inside it becomes a link.
  const TERMS = "ai.google.dev/gemma/terms";
  const [before, after = ""] = t("site.how.gemma").split(TERMS);
</script>

<Seo path="/how/" />

<section class="band">
  <Steps heading="h1" />
</section>

<section class="band alt" use:reveal>
  <Shrink />
</section>

<section class="band">
  <p class="t-small">{before}<a href={`https://${TERMS}`}>{TERMS}</a>{after}</p>
</section>
