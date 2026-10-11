<!-- I7 Find them (sun mode). Arrow, distance and speech; works with no signal from the target saved at Lit (SRS-CMP-1 to -7). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Compass from "../components/Compass.svelte";
  import { t } from "#lib/copy/index.ts";
  import Tip from "../components/Tip.svelte";
  import type { Theme } from "../components/parts";
  let {
    theme = "dark", // 2026 direction: Find them is dark and full screen
    name,
    status = "pointing",
    meters = 0,
    bearing = 0,
    talking = true,
    live = false,
    savedAt = "",
    note = "",
    onhere,
    ontalk,
    onclose,
  }: {
    theme?: Theme;
    name: string;
    status?: "pointing" | "facing" | "near" | "no-orientation" | "no-gps";
    meters?: number;
    bearing?: number;
    talking?: boolean;
    /** Live sensors: plays the facing tick and speaks on the SRS-CMP-2 cadence. Off in the catalog. */
    live?: boolean;
    savedAt?: string;
    note?: string; // permission note, e.g. perm.motion.denied
    onhere?: () => void;
    ontalk?: (on: boolean) => void;
    onclose?: () => void;
  } = $props();
</script>

<Screen {theme} sound {onclose} heading={t("compass.heading")} title={t("compass.heading")} offline={savedAt ? t("app.offline", { time: savedAt }) : ""}>
  <div class="center">
    <Compass {name} {status} {meters} {bearing} cues={live} speak={live && talking} />
  </div>
  <Tip id="compass" text="tip.compass" />
  {#if note}<p class="note t-small" role="status">{note}</p>{/if}
  <p class="note t-small t-muted">{t("compass.disclaimer")}</p>
  {#snippet actions()}
    <Button icon="here" onclick={onhere}>{t("lit.here")}</Button>
    <Button variant="text" onclick={() => ontalk?.(!talking)}>{talking ? t("compass.stop") : t("compass.start")}</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: grid; place-items: center; }
  .note { text-align: center; margin: 0; }
</style>
