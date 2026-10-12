<!-- "AI on this phone" (/ai/): what runs where, what never leaves the phone, the last tier used,
     and the models we measured but don't ship (SRS-AI-4, CR-E2). Reads only local state. -->
<script lang="ts">
  // ADR-0022: say exactly when DigitalOcean is used, from the server's own /config.
  let cloudOn = $state(false);
  $effect(() => {
    fetch("/api/v1/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { cloud_ai?: { ladder?: boolean } } | null) => (cloudOn = !!c?.cloud_ai?.ladder))
      .catch(() => (cloudOn = false));
  });
  import { onMount } from "svelte";
  import { detect } from "#lib/capabilities/index.ts";
  import { t } from "#lib/ai/copy.ts";
  import { MEASURED } from "#lib/ai/measured.ts";
  import { createTierStore, type Feature, recordConditionsRun, type TierRecord, tierLabel } from "#lib/ai/tier.ts";
  import { parse, parseError } from "#lib/conditions/index.ts";
  import { timeLabel } from "#lib/conditions/time.ts";

  const FEATURES: Feature[] = ["photo", "conditions", "ladder"];
  let last: Partial<Record<Feature, TierRecord>> = $state({});
  let caps: { key: string; label: string; value: string }[] = $state([]);
  let showMeasured = $state(false);

  const yes = (b: boolean) => t(b ? "ai.phone.yes" : "ai.phone.no");

  onMount(() => {
    last = createTierStore().all();
    const c = detect();
    caps = [
      { key: "camera", label: t("ai.cap.camera"), value: yes(c.camera === "live") },
      { key: "resize", label: t("ai.cap.resize"), value: yes(c.offscreenCanvas) },
      { key: "compass", label: t("ai.cap.compass"), value: yes(c.orientation !== "none") },
      { key: "speech", label: t("ai.cap.speech"), value: yes(c.speech) },
      {
        key: "push",
        label: t("ai.cap.push"),
        value: c.push === "needs-install" ? t("ai.cap.pushInstall") : yes(c.push === "available"),
      },
    ];
  });

  // Try a condition: the real parser, on this phone, no group (so names are refused honestly).
  let typed = $state("");
  let result = $state("");
  let tookMs = $state(0);
  function check(e: SubmitEvent) {
    e.preventDefault();
    const t0 = performance.now();
    const r = parse(typed, { members: [], tz: zone(), now: new Date().toISOString(), kind: "plan" });
    tookMs = Math.round((performance.now() - t0) * 100) / 100;
    result = r.ok ? r.readBack : parseError(r);
    const store = createTierStore();
    recordConditionsRun(store, tookMs);
    last = store.all();
  }

  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lastLine = (r: TierRecord | undefined) =>
    r
      ? t("ai.last.line", {
          // Conditions are read by the rules parser here, so they say "Made on this phone".
          tier: r.feature === "conditions" ? t("app.tier.phone") : tierLabel(r.tier),
          ms: r.ms,
          when: timeLabel(r.at, zone()),
        })
      : t("ai.last.none");
</script>

<svelte:head><title>{t("ai.title")}</title></svelte:head>

<main>
  <h1>{t("ai.title")}</h1>

  <section aria-labelledby="where">
    <h2 id="where">{t("ai.where.title")}</h2>
    <dl>
      {#each FEATURES as f (f)}
        <div class="row" data-feature={f}>
          <dt>{t(`ai.feature.${f}`)}</dt>
          <dd>{t(`ai.run.${f}`)}</dd>
          <dd class="last" data-testid={`last-${f}`}>
            {lastLine(last[f])}{#if last[f]?.why}. {t(`ai.why.${last[f]?.why}`)}{/if}
          </dd>
        </div>
      {/each}
    </dl>
    <p class="hint">{t("ai.hubBody")}</p>
  </section>

  <section aria-labelledby="never">
    <h2 id="never">{t("ai.never.title")}</h2>
    <ul>
      <li>{t("ai.never.typed")}</li>
      <li>{t("ai.never.place")}</li>
      <li>{t("ai.never.photo")}</li>
    </ul>
  </section>

  <section aria-labelledby="cloud">
    <h2 id="cloud">{t("ai.cloud.title")}</h2>
    {#if cloudOn}
      <ul>
        <li>{t("ai.cloud.ladder")}</li>
        <li>{t("ai.cloud.photo")}</li>
        <li>{t("ai.remember")}</li>
      </ul>
    {:else}
      <p>{t("ai.cloud.off")}</p>
    {/if}
  </section>

  <section aria-labelledby="try">
    <h2 id="try">{t("ai.try.title")}</h2>
    <form onsubmit={check}>
      <label for="cond">{t("cond.label")}</label>
      <input id="cond" name="cond" autocomplete="off" placeholder={t("cond.placeholder")} bind:value={typed} />
      <button type="submit">{t("cond.check")}</button>
    </form>
    <p class="hint">{t("ai.try.note")}</p>
    {#if result}
      <p class="result" role="status" data-testid="try-result">{result}</p>
      <p class="hint">{t("ai.try.took", { ms: tookMs })}</p>
    {/if}
  </section>

  <section aria-labelledby="phone">
    <h2 id="phone">{t("ai.phone.title")}</h2>
    <dl class="caps">
      {#each caps as c (c.key)}
        <div class="row"><dt>{c.label}</dt><dd>{c.value}</dd></div>
      {/each}
    </dl>
  </section>

  <section aria-labelledby="measured">
    <h2 id="measured">{t("ai.measured.title")}</h2>
    <p>{t("ai.measured.body")}</p>
    <button type="button" aria-expanded={showMeasured} onclick={() => (showMeasured = !showMeasured)}>
      {t("ai.measured.link")}
    </button>
    {#if showMeasured}
      <ul class="measured">
        {#each MEASURED as m (m.model)}
          <li>{t("ai.measured.row", { model: m.model, mb: m.mb, reason: t(`ai.reason.${m.reason}`) })}</li>
        {/each}
        <li>{t("ai.measured.sounds")}</li>
      </ul>
    {/if}
  </section>
</main>

<style>
  :global(:root) {
    --ai-bg: #fffaf5;
    --ai-fg: #1b1b1f;
    --ai-muted: #5c5c66;
    --ai-card: #ffffff;
    --ai-line: #e6ded6;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --ai-bg: #141418;
      --ai-fg: #f2f0ee;
      --ai-muted: #a6a6b0;
      --ai-card: #1e1e24;
      --ai-line: #34343c;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--ai-bg);
    color: var(--ai-fg);
    font: 17px/1.45 system-ui, -apple-system, sans-serif;
  }
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }
  h1 {
    font-size: 1.75rem;
    margin: 0 0 16px;
  }
  h2 {
    font-size: 1.1rem;
    margin: 0 0 8px;
  }
  section {
    background: var(--ai-card);
    border: 1px solid var(--ai-line);
    border-radius: 14px;
    padding: 14px 16px;
    margin: 0 0 14px;
  }
  dl {
    margin: 0;
  }
  .row {
    padding: 8px 0;
    border-top: 1px solid var(--ai-line);
  }
  .row:first-child {
    border-top: 0;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 2px 0 0;
  }
  .last,
  .hint {
    color: var(--ai-muted);
    font-size: 0.95rem;
  }
  .caps .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  ul {
    margin: 0;
    padding-left: 1.2rem;
  }
  li {
    margin: 4px 0;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  label {
    width: 100%;
    font-weight: 600;
  }
  input {
    font: inherit;
    flex: 1 1 12rem;
    min-width: 0;
    min-height: 44px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--ai-line);
    background: var(--ai-bg);
    color: var(--ai-fg);
  }
  .result {
    font-weight: 600;
    margin: 8px 0 0;
  }
  button {
    font: inherit;
    min-height: 44px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid var(--ai-line);
    background: var(--ai-bg);
    color: var(--ai-fg);
    margin: 8px 0;
  }
  button:focus-visible {
    outline: 3px solid #ff6a2b;
    outline-offset: 2px;
  }
</style>
