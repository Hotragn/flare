<!-- Run it yourself (W6), the README's setup steps. Commands are code, not copy. -->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import Seo from "../Seo.svelte";

  const install = `git clone https://github.com/Hotragn/flare-outside && cd flare-outside
npm ci
cp .env.example .env        # then set HUB_SECRET (32+ random characters)
npm run check-env           # reports set or missing, never values
npm run build && npm start  # server and web app on http://localhost:8787`;
  const hub = `ollama pull gemma4:e4b-it-q4_K_M
npm run hub`;
</script>

<Seo path="/run/" />

<section class="band">
  <h1 class="t-title">{t("site.run.title")}</h1>
  <p class="lead">{t("site.run.body")}</p>
  <p>{t("site.run.needs")}</p>
  <ol class="run-steps">
    <li><p>{t("site.run.s1")}</p><pre><code>{install}</code></pre></li>
    <li><p>{t("site.run.s2")}</p><pre><code>{hub}</code></pre></li>
    <li><p>{t("site.run.s3")}</p></li>
  </ol>
  <p>{t("site.run.db")}</p>
  <p class="t-small">{t("site.run.note")}</p>
  <p class="t-small">{t("site.run.license")}</p>
</section>
