<!-- O5 Bench to Bench: a loop that never goes too far between seats, plus a large-print card (FR-REST-*). -->
<script lang="ts">
  import Screen from "../components/Screen.svelte";
  import Button from "../components/Button.svelte";
  import TextField from "../components/TextField.svelte";
  import Icon from "../components/Icon.svelte";
  import { loop } from "../sample";
  import type { Theme } from "../components/parts";
  let { view = "loop", theme = "light", wire = false }: { view?: string; theme?: Theme; wire?: boolean } = $props();
  let ask = $state(loop.ask);
</script>

<Screen {theme} {wire} title="Bench to Bench">
  {#if view === "request"}
    <h1 class="t-title">What kind of walk?</h1>
    <TextField label="In your words" bind:value={ask} placeholder="Knee's bad, 40 minutes, want trees" mic max={80} />
  {:else if view === "readback"}
    <h1 class="t-title">Got it: {loop.readback} Right?</h1>
  {:else if view === "none"}
    <div class="none">
      <Icon name="bench" size={48} />
      <h1 class="t-title">No loop keeps benches that close.</h1>
      <p>Try 300 m between seats?</p>
    </div>
  {:else}
    <h1 class="t-title">{loop.minutes} min · {(loop.totalMeters / 1000).toFixed(1)} km · 4 benches</h1>
    <article class="card" aria-label="Large-print card preview">
      <svg class="sketch" viewBox="0 0 300 140" aria-hidden="true">
        <path d="M40 110 C40 40 120 20 180 30 C250 40 270 100 220 120 C170 135 90 135 40 110 Z" fill="none" stroke="var(--c-ink-900)" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round" />
        {#each [[40, 110], [120, 26], [220, 50], [200, 124]] as [x, y], i}<g><circle cx={x} cy={y} r="13" fill="var(--c-maple-700)" /><text x={x} y={y + 6} text-anchor="middle" font-size="16" font-weight="700" fill="#fff">{i + 1}</text></g>{/each}
      </svg>
      <ol class="turns">{#each loop.turns as t}<li>{t}</li>{/each}</ol>
      <p class="warn">Check the path. Map data can be wrong.</p>
    </article>
  {/if}
  {#snippet actions()}
    {#if view === "loop"}
      <Button icon="card">Print card</Button>
      <Button variant="text">Read it aloud</Button>
    {:else if view === "readback"}
      <Button>Make the loop</Button><Button variant="text">Fix it</Button>
    {:else if view === "none"}
      <Button>Try 300 m</Button>
    {:else}
      <Button>Check it</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  h1, p { margin: 0; }
  .none { flex: 1; display: grid; place-items: center; text-align: center; gap: 8px; align-content: center; }
  .card { background: #fff; color: #111; border-radius: 8px; padding: 18px; box-shadow: var(--e-3); display: flex; flex-direction: column; gap: 10px; }
  .sketch { width: 100%; height: auto; }
  .turns { margin: 0; padding-left: 22px; font-size: 18pt; line-height: 1.3; font-weight: 700; display: flex; flex-direction: column; gap: 6px; }
  .turns li { font-size: 1.15rem; }
  .warn { font-weight: 700; border-top: 2px solid #111; padding-top: 8px; }
</style>
