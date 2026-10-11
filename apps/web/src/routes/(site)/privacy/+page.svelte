<!-- Privacy statement (docs/content/04, variant B; SRS-WEB-2): promises, what we keep, the
     limits, and the live deletion audit from GET /api/v1/audit, which fails soft. -->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { t, variant, type CopyKey } from "#lib/copy/index.ts";
  import Seo from "../Seo.svelte";
  import { reveal } from "../reveal.ts";
  import { fetchAudit, type AuditView } from "../audit.ts";

  const coords = variant("privacy.coords");
  const rows = ["photo", "yes", coords === "B" ? "coordsB" : "coordsA", "phone", "sparks", "alerts", "counts", "logs"];
  const cell = (row: string, col: "what" | "where" | "when") => t(`site.privacy.row.${row}.${col}` as CopyKey);
  const promises: CopyKey[] = ["site.privacy.p1", "site.privacy.p2", "site.privacy.p3", "site.privacy.p4", "site.privacy.p5"];
  const limits: CopyKey[] = [
    "site.privacy.l.telegram",
    "site.privacy.l.guess",
    "site.privacy.l.sms",
    "site.privacy.l.link",
    coords === "B" ? "site.privacy.l.coordsB" : "site.privacy.l.coordsA",
    "site.privacy.l.hub",
    "site.privacy.l.weather",
    "site.privacy.l.sentry",
    "site.privacy.l.cloud",
    "site.privacy.l.push",
  ];

  let audit: AuditView | null = $state(null);
  onMount(async () => {
    audit = await fetchAudit(fetch);
  });
  const time = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
</script>

<Seo path="/privacy/" />

<section class="band page-head">
  <h1 class="t-title">{t("site.privacy.title")}</h1>
</section>

<section class="band">
  <div class="two">
    <ul class="checks">
      {#each promises as key}<li><Icon name="here" /><span>{t(key)}</span></li>{/each}
    </ul>
    <div class="audit" aria-live="polite">
      <h2 class="label t-body">{t("site.privacy.auditTitle")}</h2>
      {#if audit?.s === "ok"}
        <p>{t("site.privacy.audit.live", { time: time(audit.at) })}</p>
        <p class:bad={!audit.pass}>
          {audit.pass ? t("site.privacy.audit.pass", { n: audit.stores.length }) : t("site.privacy.audit.fail", { n: audit.leftover })}
        </p>
        <table>
          <caption>{t("site.privacy.audit.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("site.privacy.audit.colStore")}</th>
              <th scope="col" class="num">{t("site.privacy.audit.colLeft")}</th>
              <th scope="col" class="num">{t("site.privacy.audit.colTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {#each audit.stores as s (s.store + s.table)}
              <tr>
                <th scope="row">{s.store} {s.table}</th>
                <td class="num" class:bad={s.per_gathering && s.expired_rows > 0}>{s.expired_rows}</td>
                <td class="num">{s.total_rows}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <pre><code>{t("site.privacy.audit1")}
{t("site.privacy.audit2")}</code></pre>
        {#if audit?.s === "down"}<p>{t("site.privacy.audit.down")}</p>{/if}
      {/if}
    </div>
  </div>
</section>

<section class="band alt" use:reveal>
  <h2 class="t-title">{t("site.privacy.keepTitle")}</h2>
  <ul class="keep">
    {#each rows as row}
      <li>
        <h3>{cell(row, "what")}</h3>
        <dl>
          <dt>{t("site.privacy.colWhere")}</dt><dd>{cell(row, "where")}</dd>
          <dt>{t("site.privacy.colWhen")}</dt><dd>{cell(row, "when")}</dd>
        </dl>
      </li>
    {/each}
  </ul>
</section>

<section class="band" use:reveal>
  <h2 class="t-title">{t("site.privacy.limitsTitle")}</h2>
  <ul class="limits">
    {#each limits as key}<li><Icon name="warning" /><span>{t(key)}</span></li>{/each}
  </ul>
</section>
