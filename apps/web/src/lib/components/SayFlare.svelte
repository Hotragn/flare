<!-- Voice Flare (ADR-0028): "Say where you are" on the camera screen. Records the host's own voice
     for up to 10 s after a tap; Gemma 4 on our laptop writes the invite from it; no audio kept. -->
<script lang="ts">
  import Button from "./Button.svelte";
  import { t } from "#lib/copy/index.ts";
  import { draftVoice, startVoice } from "#lib/voice/flare.ts";
  import { SPARK_MAX_MS, type Recording } from "#lib/voice/spark.ts";
  let { ondraft }: { ondraft?: (d: { invite: string; alt: string }) => void } = $props();
  let phase = $state<"idle" | "listening" | "working">("idle");
  let left = $state(10);
  let error = $state("");
  let rec: Recording | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;
  async function toggle() {
    if (phase === "listening") {
      rec?.stop();
      return;
    }
    error = "";
    try {
      rec = await startVoice();
    } catch {
      error = t("voiceFlare.fail");
      return;
    }
    phase = "listening";
    left = SPARK_MAX_MS / 1000;
    tick = setInterval(() => (left = Math.max(0, left - 1)), 1000);
    const clip = await rec.done;
    clearInterval(tick);
    rec = null;
    phase = "working";
    const d = clip ? await draftVoice(clip) : null;
    phase = "idle";
    if (d) ondraft?.(d);
    else error = t("voiceFlare.fail");
  }
  $effect(() => () => {
    clearInterval(tick);
    rec?.stop();
  });
</script>

<div class="say">
  <Button variant="secondary" icon="mic" loading={phase === "working"} onclick={toggle}>{phase === "listening" ? t("spark.stop") : t("voiceFlare.cta")}</Button>
  <p class="t-small" role="status" aria-live="polite">{phase === "listening" ? t("spark.listening", { s: left }) : phase === "working" ? t("voiceFlare.working") : error || t("voiceFlare.note")}</p>
</div>

<style>
  .say { display: flex; flex-direction: column; gap: 6px; align-items: stretch; width: 100%; }
  .say p { margin: 0; text-align: center; }
</style>
