<!-- W3 It shrinks instead of dying: Kindling, Lit, Ember, Gone, and the Plan ladder. -->
<script lang="ts">
  import Flame from "#lib/components/Flame.svelte";
  import { t } from "#lib/copy/site.ts";
</script>

<h2 class="t-title">{t("site.shrink.title")}</h2>
<p class="lead">{t("site.shrink.lead")}</p>
<ul class="states">
  <li><Flame state="kindling" progress={0.5} size={96} /><b>{t("flame.kindling")}</b><span>{t("site.shrink.kindling")}</span></li>
  <li><Flame state="lit" size={96} /><b>{t("flame.lit")}</b><span>{t("site.shrink.lit")}</span></li>
  <li><Flame state="ember" size={96} /><b>{t("flame.ember")}</b><span>{t("site.shrink.ember")}</span></li>
  <li><Flame state="gone" size={96} /><b>{t("flame.gone")}</b><span>{t("site.shrink.gone")}</span></li>
</ul>
<p>{t("site.shrink.plan")}</p>
