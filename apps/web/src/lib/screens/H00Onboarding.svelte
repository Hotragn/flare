<!-- First run (backlog #4): three cards over the outdoors (what Flare is, the private yes, that it
     deletes itself), then your name once, then how to start. Swipe or tap Next; Skip anytime. -->
<script lang="ts">
  import Button from "../components/Button.svelte";
  import Flame from "../components/Flame.svelte";
  import Scenery from "../components/Scenery.svelte";
  import ScenicHero from "../components/ScenicHero.svelte";
  import TextField from "../components/TextField.svelte";
  import { t } from "#lib/copy/index.ts";
  let { onlight, ondemo }: { onlight?: () => void; ondemo?: () => void } = $props();
  const cards = [
    { title: t("onb.1.title"), body: t("onb.1.body") },
    { title: t("onb.2.title"), body: t("onb.2.body") },
    { title: t("onb.3.title"), body: t("onb.3.body") },
  ];
  let step = $state(0); // 0..2 cards, 3 name, 4 start
  let name = $state("");
  let linkHelp = $state(false);
  let pasted = $state("");
  let badLink = $state(false);
  // Fresh-eyes #6: a pasted link opens here. Only this site's own links; the key after # stays
  // on this phone (a same-page navigation sends no fragment to any server).
  function openLink() {
    try {
      const u = new URL(pasted.trim(), location.origin);
      if (u.origin !== location.origin || !u.pathname.startsWith("/g/")) throw new Error("not ours");
      location.assign(u.pathname + u.search + u.hash);
    } catch {
      badLink = true;
    }
  }
  let track: HTMLDivElement | undefined = $state();
  const go = (i: number) => {
    step = i;
    if (i < 3) track?.children[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };
  const onScroll = () => {
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== step && i < 3) step = i;
  };
  function saveName() {
    try {
      localStorage.setItem("flare.name", name.trim().slice(0, 24));
    } catch {
      // private mode: Send asks for the name instead
    }
    step = 4;
  }
</script>

<main class="onb">
  <div class="art" aria-hidden="true"><ScenicHero slugs={["pictured-rocks-cliffs", "sleeping-bear-dunes", "acadia-eagle-lake"]} start={step} everyMs={60000} /></div>
  <div class="veil" aria-hidden="true"></div>
  {#if step < 3}
    <button class="skip" onclick={() => (step = 3)}>{t("onb.skip")}</button>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scroll, axe scrollable-region-focusable) -->
    <div class="track" bind:this={track} onscroll={onScroll} tabindex="0" role="group" aria-label={t("onb.cardAria", { n: step + 1 })}>
      {#each cards as c, i}
        <section class="card" aria-label={t("onb.cardAria", { n: i + 1 })}>
          <Flame state={i === 2 ? "gone" : "lit"} size={84} />
          <h1 class="t-display">{c.title}</h1>
          <p>{c.body}</p>
        </section>
      {/each}
    </div>
    <div class="foot">
      <div class="dots" aria-hidden="true">{#each cards as _, i}<span class:on={i === step}></span>{/each}</div>
      <Button onclick={() => go(step + 1)}>{t("onb.next")}</Button>
    </div>
  {:else if step === 3}
    <div class="panel">
      <h1 class="t-display">{t("onb.name")}</h1>
      <TextField label={t("join.nameLabel")} bind:value={name} placeholder={t("join.namePlaceholder")} hint={t("onb.nameHint")} max={24} />
      <Button disabled={!name.trim()} onclick={saveName}>{t("onb.go")}</Button>
    </div>
  {:else}
    <div class="panel">
      <h1 class="t-display">{t("onb.how")}</h1>
      <Button icon="camera" onclick={onlight}>{t("home.light")}</Button>
      <Button variant="secondary" onclick={ondemo}>{t("demo.try")}</Button>
      <Button variant="text" onclick={() => (linkHelp = true)}>{t("onb.link")}</Button>
      {#if linkHelp}
        <TextField label={t("onb.pasteLabel")} bind:value={pasted} hint={t("onb.linkHelp")} error={badLink ? t("onb.badLink") : ""} max={400} />
        <Button variant="secondary" disabled={!pasted.trim()} onclick={openLink}>{t("onb.open")}</Button>
      {/if}
    </div>
  {/if}
</main>

<style>
  .onb { position: fixed; inset: 0; color: #fff; display: flex; flex-direction: column; background: #120806; }
  .art, .veil { position: absolute; inset: 0; }
  .art :global(svg) { width: 100%; height: 100%; display: block; }
  .veil { background: linear-gradient(to bottom, rgb(0 0 0 / 0.1) 0%, rgb(0 0 0 / 0.25) 45%, rgb(0 0 0 / 0.82) 100%); }
  .skip { position: absolute; top: calc(env(safe-area-inset-top, 0) + 12px); right: 12px; z-index: 2; min-height: 44px; padding: 0 16px;
    border: 0; border-radius: 999px; background: rgb(0 0 0 / 0.5); color: #fff; font-weight: 700; backdrop-filter: blur(12px); }
  .track { position: relative; flex: 1; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .track::-webkit-scrollbar { display: none; }
  .card { flex: 0 0 100%; scroll-snap-align: start; display: flex; flex-direction: column; justify-content: flex-end; gap: 10px;
    padding: 0 var(--l-gutter) 24px; text-shadow: 0 1px 12px rgb(0 0 0 / 0.5); }
  .card h1, .card p, .panel h1 { margin: 0; }
  .card p { font-size: calc(1.25rem * var(--text-scale)); font-weight: 600; max-width: 26ch; }
  .foot { position: relative; padding: 12px var(--l-gutter) calc(24px + env(safe-area-inset-bottom, 0)); display: flex; flex-direction: column; gap: 14px; }
  .dots { display: flex; justify-content: center; gap: 8px; }
  .dots span { width: 8px; height: 8px; border-radius: 50%; background: rgb(255 255 255 / 0.4); transition: width var(--dur-base); }
  .dots span.on { width: 22px; border-radius: 4px; background: #fff; }
  .panel { position: relative; margin-top: auto; display: flex; flex-direction: column; gap: 14px; padding: 20px var(--l-gutter) calc(24px + env(safe-area-inset-bottom, 0));
    border-radius: 28px 28px 0 0; background: rgb(18 16 16 / 0.8); backdrop-filter: blur(28px) saturate(1.6); -webkit-backdrop-filter: blur(28px) saturate(1.6); }
  /* Fresh-eyes #5: light outlines and text on the dark sheet, 4.5:1 or better. */
  .panel :global(.btn.secondary) { color: #fff; border-color: rgb(255 255 255 / 0.85); background: rgb(255 255 255 / 0.08); }
  .panel :global(.btn.text) { color: #fff; }
  /* Fresh-eyes #14: hints and labels at full strength on the dark sheet. */
  .panel :global(.t-muted), .panel :global(label) { color: rgb(255 255 255 / 0.88); }
  @media (prefers-reduced-motion: reduce) { .dots span { transition: none; } }
</style>
