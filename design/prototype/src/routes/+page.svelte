<script lang="ts">
  import Flame from "#lib/components/Flame.svelte";
</script>

<svelte:head><title>Flare design</title></svelte:head>

<main class="home grain" data-theme="light">
  <Flame state="lit" size={96} />
  <h1 class="t-display">Flare design files</h1>
  <ul>
    <li><a href="/proto/">Clickable prototype</a>: the seven key moments.</li>
    <li><a href="/screens/">Screens</a>: every screen, state and theme.</li>
    <li><a href="/components/">Components</a>: every component and state.</li>
    <li><a href="/site/">Website</a>: the one-page site.</li>
  </ul>
</main>

<style>
  .home { min-height: 100vh; padding: 48px 24px; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  h1 { margin: 0; }
  ul { margin: 0; padding-left: 20px; font-size: 1.2rem; display: flex; flex-direction: column; gap: 8px; }
  a { color: var(--accent-text); font-weight: 700; }
</style>
