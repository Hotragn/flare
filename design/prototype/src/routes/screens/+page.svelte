<!-- Screen catalog: every screen, its states and themes. PNGs of each are in design/exports/screens. -->
<script lang="ts">
  import { screens } from "#lib/screens/registry.ts";
  let filter = $state("");
  const shown = $derived(screens.filter((s) => !filter || s.id.startsWith(filter)));
</script>

<svelte:head><title>Flare screens</title></svelte:head>

<main class="cat" data-theme="light">
  <h1 class="t-title">Flare screens</h1>
  <p>{screens.length} screens · {screens.reduce((n, s) => n + s.states.length * s.themes.length, 0)} screen states. Open one to see it at phone size.</p>
  <div class="filters" role="group" aria-label="Filter">
    {#each [["", "All"], ["H", "Host"], ["I", "Invitee"], ["P", "Plan"], ["O", "Other"]] as [v, l]}
      <button aria-pressed={filter === v} onclick={() => (filter = v)}>{l}</button>
    {/each}
  </div>
  <div class="grid">
    {#each shown as s}
      <section class="card">
        <h2><span class="id">{s.id}</span> {s.name}</h2>
        <ul>
          {#each s.states as st}
            <li>{st}: {#each s.themes as th}<a href="/screens/{s.id}/?state={st}&theme={th}">{th}</a>{" "}{/each}</li>
          {/each}
        </ul>
        <a class="thumb" href="/screens/{s.id}/?state={s.states[0]}&theme={s.themes[0]}">
          <img src="/exports/{s.id}-{s.states[0]}-{s.themes[0]}.png" alt="{s.id} {s.name}, {s.states[0]}, {s.themes[0]}" loading="lazy" width="195" height="422" />
        </a>
      </section>
    {/each}
  </div>
</main>

<style>
  .cat { padding: 24px; max-width: 1200px; margin: 0 auto; }
  h1, p { margin: 0 0 8px; }
  .filters { display: flex; gap: 6px; margin: 12px 0 20px; flex-wrap: wrap; }
  .filters button { min-height: 44px; padding: 0 16px; border-radius: var(--r-pill); border: 2px solid var(--text); background: transparent; font-weight: 700; }
  .filters button[aria-pressed="true"] { background: var(--text); color: var(--bg); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .card { background: var(--surface); border-radius: var(--r-lg); padding: 16px; box-shadow: var(--e-1); display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: 1.1rem; }
  .id { display: inline-block; min-width: 2.4em; padding: 2px 8px; border-radius: var(--r-pill); background: var(--lit); color: var(--c-ink-900); text-align: center; }
  ul { margin: 0; padding-left: 18px; font-size: 0.95rem; }
  a { color: var(--accent-text); font-weight: 700; }
  .thumb img { border-radius: 14px; box-shadow: var(--e-2); }
</style>
