<!-- Host your own copy (W6). Using Flare needs nothing; this is for your own server. Three levels:
     no AI keys, a free Google AI Studio key, or Ollama on your own machine. Commands are code. -->
<script lang="ts">
  import { t } from "#lib/copy/site.ts";
  import Seo from "../Seo.svelte";

  const install = `git clone https://github.com/Hotragn/flare && cd flare
npm ci
cp .env.example .env        # then set HUB_SECRET (32+ random characters)
npm run check-env           # reports set or missing, never values
npm run build && npm start  # server and web app on http://localhost:8787
# level 2 only: add GEMINI_API_KEY=... to .env (a free key from aistudio.google.com)`;
  const hub = `ollama pull gemma4:e4b-it-q4_K_M
npm run hub`;
</script>

<Seo path="/run/" />

<section class="band">
  <h1 class="t-title">{t("site.run.title")}</h1>
  <p class="lead">{t("site.run.body")}</p>
  <p>{t("site.run.needs")}</p>
  <h2 class="t-heading">{t("site.run.levels.title")}</h2>
  <ol class="levels">
    <li>{t("site.run.level1")}</li>
    <li>{t("site.run.level2")}</li>
    <li>{t("site.run.level3")}</li>
  </ol>
  <ol class="run-steps">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scroll, axe scrollable-region-focusable) -->
    <li><p>{t("site.run.s1")}</p><pre tabindex="0"><code>{install}</code></pre></li>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scroll, axe scrollable-region-focusable) -->
    <li><p>{t("site.run.s2")}</p><pre tabindex="0"><code>{hub}</code></pre></li>
    <li><p>{t("site.run.s3")}</p></li>
  </ol>
  <p>{t("site.run.db")}</p>
  <p class="t-small">{t("site.run.note")}</p>
  <p class="t-small">{t("site.run.license")}</p>
</section>
