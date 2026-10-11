<!-- Sound on/off for screens that make sound (founder decision, Oct 10: sound on by
     default, after the first tap; the silent switch mutes it; this choice is remembered
     on the device by motion/sound.ts in localStorage). -->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { t } from "#lib/copy/index.ts";
  import { isMuted, setMuted, onMuteChange } from "#lib/motion/sound.ts";
  let muted = $state(isMuted());
  $effect(() => onMuteChange((m) => (muted = m)));
</script>

<button class="icon-btn" aria-pressed={muted} aria-label={muted ? t("app.soundOn") : t("app.soundOff")} onclick={() => setMuted(!muted)}>
  <Icon name={muted ? "mute" : "sound"} />
</button>

<style>
  .icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--text) 7%, transparent); color: var(--text); flex: none; }
  .icon-btn:active { transform: scale(0.94); }
</style>
