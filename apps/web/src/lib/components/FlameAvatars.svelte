<!-- Crew members as small flames with their initial (no photos, no profiles). `out` glows: only
     people who are Lit or arrived in an active Flare (no tracking outside a Flare). -->
<script lang="ts">
  let { people = [], size = 44 }: { people?: { name: string; out?: boolean }[]; size?: number } = $props();
  const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();
</script>

<ul class="avatars" style:--s="{size}px">
  {#each people as p}
    <li class:out={p.out}><span class="i" aria-hidden="true">{initial(p.name)}</span><span class="visually-hidden">{p.name}</span></li>
  {/each}
</ul>

<style>
  .avatars { list-style: none; margin: 0; padding: 0; display: flex; gap: 10px; flex-wrap: wrap; }
  li { width: var(--s); height: calc(var(--s) * 1.18); display: grid; place-items: end center; padding-bottom: 6px; color: #fff; font-weight: 800;
    background: var(--c-maple-600); border-radius: 50% 50% 46% 46% / 62% 62% 38% 38%; }
  li.out { background: var(--c-gold-400); color: #111; box-shadow: 0 0 18px rgb(242 179 61 / 0.7); }
  .i { font-size: calc(var(--s) * 0.4); }
</style>
