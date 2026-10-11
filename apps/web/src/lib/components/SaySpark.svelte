<!-- "Say it" for a Spark (ADR-0027): records the person's own voice for up to 10 s after a tap,
     turns it into words with Scribe (lib/voice/spark.ts), and keeps no audio. -->
<script lang="ts">
  import Button from "./Button.svelte";
  import { t } from "#lib/copy/index.ts";
  import { SPARK_MAX_MS, startSpark, transcribeSpark, type Recording } from "#lib/voice/spark.ts";
  let { line = $bindable(""), error = $bindable("") }: { line?: string; error?: string } = $props();
  let say = $state<"idle" | "listening" | "working">("idle");
  let left = $state(10);
  let rec: Recording | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;
  async function toggleSay() {
    if (say === "listening") {
      rec?.stop();
      return;
    }
    error = "";
    try {
      rec = await startSpark();
    } catch {
      error = t("spark.sayFail"); // no microphone permission
      return;
    }
    say = "listening";
    left = SPARK_MAX_MS / 1000;
    tick = setInterval(() => (left = Math.max(0, left - 1)), 1000);
    const clip = await rec.done;
    clearInterval(tick);
    rec = null;
    say = "working";
    const words = clip ? await transcribeSpark(clip) : null;
    say = "idle";
    if (words) line = words.slice(0, 140);
    else error = t("spark.sayFail");
  }
  $effect(() => () => {
    clearInterval(tick);
    rec?.stop();
  });
</script>

<div class="say">
  <Button variant="secondary" icon="mic" loading={say === "working"} onclick={toggleSay}>{say === "listening" ? t("spark.stop") : t("spark.say")}</Button>
  <p class="t-small t-muted" role="status" aria-live="polite">{say === "listening" ? t("spark.listening", { s: left }) : say === "working" ? t("spark.working") : t("spark.sayNote")}</p>
</div>

<style>
  .say { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
  .say p { margin: 0; }
</style>
