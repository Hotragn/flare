<!-- H0 Home: going outside now is the point (docs/design/09-2026-direction.md, B). Golden hour,
     the weather window, the nearest green spot, then one big Light a Flare. -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import Tip from "../components/Tip.svelte";
  import Flame from "../components/Flame.svelte";
  import Scenery from "../components/Scenery.svelte";
  import ScenicHero from "../components/ScenicHero.svelte";
  import { t } from "#lib/copy/index.ts";
  import type { Golden, Green } from "./flow/home.ts";
  let {
    golden = null,
    weather = null,
    green = null,
    located = false,
    onlight,
    onplan,
    onnear,
    onmenu,
    onagain,
  }: {
    golden?: Golden | null;
    weather?: { temp_f: number; rain_likely: boolean } | null;
    green?: Green | null;
    located?: boolean;
    onlight?: () => void;
    /** Automations: one tap, the last crew and size, no photo needed (shown once you have sent one). */
    onagain?: () => void;
    onplan?: () => void;
    onnear?: () => void;
    onmenu?: () => void;
  } = $props();
  const headline = $derived(
    !golden
      ? t("home.outside")
      : golden.kind === "soon"
        ? golden.minutes >= 60
          ? t("home.goldenH", { h: Math.floor(golden.minutes / 60), min: golden.minutes % 60 })
          : t("home.golden", { min: golden.minutes })
        : golden.kind === "now"
          ? t("home.goldenNow")
          : t("home.after"),
  );
</script>

<Screen stage menu {onmenu} close={false} heading={headline}>
  {#snippet backdropArt()}<ScenicHero />{/snippet}
  {#snippet hero()}
    <div class="hero">
      <Flame state="lit" size={96} />
      <p class="t-display">{headline}</p>
      {#if golden?.kind === "now"}<p class="sub">{t("home.goldenLeft", { min: golden.minutes })}</p>{/if}
      {#if weather}
        <p class="sub"><Icon name={weather.rain_likely ? "rain" : "sun"} size={20} />{weather.rain_likely ? t("home.rain", { temp: weather.temp_f }) : t("home.dry", { temp: weather.temp_f })}</p>
      {/if}
    </div>
  {/snippet}
  <Tip id="home" text="tip.home" />
  {#if green}
    <div class="green">
      <Icon name="hotspots" size={26} />
      <div>
        <p class="name">{t("home.green", { name: green.name, min: green.walkMin })}</p>
        {#if green.line}<p class="t-small t-muted">{green.line}</p>{/if}
      </div>
    </div>
  {:else if !located}
    <p class="t-small t-muted">{t("home.nearNote")}</p>
  {/if}
  {#snippet actions()}
    <Button icon="camera" haptic="tap" onclick={onlight}>{t("home.light")}</Button>
    <div class="row">
      {#if onagain}<Button variant="text" onclick={onagain}>{t("home.again")}</Button>{/if}
      <Button variant="text" onclick={onplan}>{t("home.plan")}</Button>
      {#if !located}<Button variant="text" onclick={onnear}>{t("home.near")}</Button>{/if}
      <a class="demo" href="/app/demo/">{t("demo.try")}</a>
    </div>
  {/snippet}
</Screen>

<style>
  .hero { display: flex; flex-direction: column; gap: 6px; }
  .hero p { margin: 0; }
  .sub { display: flex; gap: 8px; align-items: center; font-size: calc(var(--t-label-size) * var(--text-scale)); font-weight: 600; }
  .green { display: flex; gap: 12px; align-items: flex-start; }
  .green p { margin: 0; }
  .name { font-weight: 700; font-size: calc(var(--t-label-size) * var(--text-scale)); }
  .row { display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; }
  .demo { min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; color: #fff; font-weight: 700; text-underline-offset: 4px; }
</style>
