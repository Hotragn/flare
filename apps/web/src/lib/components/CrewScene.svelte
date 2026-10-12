<!--
  The crew's place (O8): everyone stands round one fire under the live sky. Each person is a
  figure with their initial (no photos, no profiles). The fire grows with this week's minutes
  outside together; with none yet, or no crew, it is an unlit fire pit, ready. Sparks float as
  small lights; tap one to read it. No streaks, no counts of who came, never who said no.
  The fire grows in once (about 1 s); the Sparks drift while the scene is on screen.
  Reduced motion: all still, the same picture.
-->
<script lang="ts">
  import { t } from "#lib/copy/index.ts";
  import { ambient } from "#lib/motion/ambient.ts";
  import Flame from "./Flame.svelte";
  let {
    people = [],
    weekMin = 0,
    sparks = [],
    empty = false,
  }: { people?: { name: string }[]; weekMin?: number; sparks?: string[]; empty?: boolean } = $props();

  // Four hours outside together in a week is a full fire; any time at all lights it.
  const fire = $derived(empty || weekMin <= 0 ? 0 : 0.5 + 0.5 * Math.min(1, weekMin / 240));
  const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();
  const TONES = ["#B8410F", "#3D6B8C", "#6B4E8A", "#2F6B52", "#9E2C17", "#7A5A2E", "#3D4F66", "#8A3B5C"];
  // Round the fire, left and right of it, the back row a little higher and smaller.
  const SLOTS = [[-78, 0], [78, 0], [-128, -14], [128, -14], [-40, -30], [40, -30], [-168, -26], [168, -26]];
  const shown = $derived(people.slice(0, SLOTS.length));
  const more = $derived(Math.max(0, people.length - SLOTS.length));
  let open = $state(-1);
  const LIGHTS = [[18, 16], [74, 10], [46, 30], [86, 34], [10, 40]];
</script>

<div class="crew-scene" use:ambient>
  {#if !empty}
    {#each sparks.slice(0, LIGHTS.length) as line, i}
      {@const [x, y] = LIGHTS[i] ?? [50, 20]}
      <div class="light" style:left="{x}%" style:top="{y}%" style:animation-delay="{i * -1.7}s">
        <button aria-label={t("crew.sparkOpen")} aria-expanded={open === i} onclick={() => (open = open === i ? -1 : i)}><span class="dot" aria-hidden="true"></span></button>
        {#if open === i}<p class="bubble" class:left={x > 55} role="status">{t("invite.sparkQuote", { line })}</p>{/if}
      </div>
    {/each}
  {/if}
  <div class="stage" role="img" aria-label={people.length ? t("crew.sceneAria", { names: people.map((p) => p.name).join(", ") }) : t("crew.empty")}>
    {#each shown as p, i (i)}
      {@const [dx, dy] = SLOTS[i] ?? [0, 0]}
      {@const back = dy < 0}
      <svg class="person" class:back class:warm={fire > 0} viewBox="0 0 40 70" style:--dx="{dx}px" style:--dy="{dy}px" style:animation-delay="{i * 60}ms" aria-hidden="true">
        <circle cx="20" cy="12" r="10" fill={TONES[i % TONES.length]} />
        <rect x="5" y="25" width="30" height="44" rx="13" fill={TONES[i % TONES.length]} />
        <text x="20" y="54" text-anchor="middle">{initial(p.name)}</text>
      </svg>
    {/each}
    {#if more}<span class="more" aria-hidden="true">+{more}</span>{/if}
    <svg class="pit" viewBox="0 0 120 40" aria-hidden="true">
      {#if fire}<ellipse cx="60" cy="24" rx="58" ry="14" class="glow" />{/if}
      <path d="M30 26 L90 14 M30 14 L90 26" class="log" />
      {#each [[14, 28], [28, 33], [46, 35], [64, 35], [82, 33], [98, 28], [106, 22], [8, 22]] as [x, y]}<ellipse cx={x} cy={y} rx="9" ry="6" class="stone" />{/each}
    </svg>
    {#if fire}
      <span class="fire" style:--k={fire}><Flame state="lit" size={92} mode="css" label="" /></span>
    {/if}
  </div>
</div>

<style>
  .crew-scene { position: relative; width: 100%; height: 150px; flex: none; }
  .stage { position: absolute; inset: 0; }
  .stage svg { max-width: none; }
  .person { position: absolute; bottom: 8px; left: calc(50% - 20px); width: 40px; height: 70px; transform: translate(var(--dx), var(--dy)); overflow: visible; animation: arrive 520ms var(--ease-out) both; }
  .person.back { width: 34px; height: 60px; left: calc(50% - 17px); filter: brightness(0.85); }
  .person.warm rect, .person.warm circle { stroke: rgb(242 179 61 / 0.55); stroke-width: 1.5; }
  .person text { font: 800 19px/1 var(--font-ui, system-ui), sans-serif; fill: #fff; }
  .more { position: absolute; right: 4px; bottom: 30px; color: #fff; font-weight: 800; }
  .pit { position: absolute; left: calc(50% - 60px); bottom: 0; width: 120px; height: 40px; }
  .stone { fill: #5b5550; stroke: #2b2724; stroke-width: 1.5; }
  .log { stroke: #5a3a22; stroke-width: 7; stroke-linecap: round; }
  .glow { fill: rgb(242 179 61 / 0.35); }
  /* The fire: its size is this week's time together; it grows in once. */
  .fire { position: absolute; left: calc(50% - 46px); bottom: 12px; width: 92px; height: 92px; transform-origin: 50% 100%; transform: scale(var(--k)); animation: grow 1s var(--ease-spring) both; }
  @keyframes grow { from { transform: scale(0.2); opacity: 0; } to { transform: scale(var(--k)); opacity: 1; } }
  @keyframes arrive { from { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 10px)); } to { opacity: 1; transform: translate(var(--dx), var(--dy)); } }
  /* Sparks: small lights in the air, each a 44 px button. */
  .light { position: absolute; width: 44px; height: 44px; margin: -22px; animation: float 7s ease-in-out infinite; z-index: 2; }
  .light button { width: 44px; height: 44px; border: 0; padding: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; }
  .light button:focus-visible { outline: 3px solid #fff; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #fff4cf; box-shadow: 0 0 10px 4px rgb(242 179 61 / 0.7); }
  .light button[aria-expanded="true"] .dot { background: var(--c-gold-400); }
  .bubble { position: absolute; top: 40px; left: 0; width: max-content; max-width: 220px; margin: 0; padding: 8px 12px; border-radius: 14px; background: rgb(18 16 16 / 0.82); color: #fff; font-weight: 700; font-size: calc(var(--t-small-size) * var(--text-scale)); }
  .bubble.left { left: auto; right: 0; }
  @keyframes float { 0%, 100% { transform: translate(0, 0); } 33% { transform: translate(6px, -8px); } 66% { transform: translate(-5px, -3px); } }
  :global(.crew-scene[data-paused] *) { animation-play-state: paused; }
  @media (prefers-reduced-motion: reduce) { .crew-scene * { animation: none !important; } }
  :global([data-reduce-motion]) .crew-scene * { animation: none !important; }
</style>
