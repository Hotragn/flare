<!-- How it works (W2 and W3 in full). -->
<script lang="ts">
  import Seo from "../Seo.svelte";
  import Steps from "../Steps.svelte";
  import Shrink from "../Shrink.svelte";
  import { reveal } from "../reveal.ts";
</script>

<Seo path="/how/" />

<section class="band">
  <Steps heading="h1" />
</section>

<section class="band alt" use:reveal>
  <Shrink />
</section>
