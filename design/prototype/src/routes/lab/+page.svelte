<!-- /lab: test pages for Sunday's iPhone check (motion and sound). -->
<svelte:head><title>Motion test pages</title></svelte:head>

<main class="lab" data-theme="light">
  <h1 class="t-title">Motion test pages</h1>
  <p class="t-small t-muted">Open these in Safari on each iPhone. Each page has a Copy results button.</p>
  <ul>
    <li><a href="/lab/fps/">Flame frame rate</a>: fps, p95 frame time, pixel ratio, 60 or 120 Hz.</li>
    <li><a href="/lab/haptics/">Haptics and sound</a>: the switch haptic, vibrate, the four sounds, the silent switch.</li>
    <li><a href="/lab/motion/">Motion lab</a>: every micro-interaction, with Reduce motion on and off.</li>
  </ul>
</main>

<style>
  .lab { max-width: 640px; margin: 0 auto; padding: 16px; background: var(--bg); min-height: 100vh; }
  ul { padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
  a { color: var(--accent-text); font-weight: 700; display: inline-flex; min-height: 44px; align-items: center; }
</style>
