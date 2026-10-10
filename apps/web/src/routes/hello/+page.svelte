<!-- End-to-end hello world: phone page -> server -> hub relay -> Ollama -> back. -->
<script lang="ts">
  import { DraftResponse, type DraftResponseT } from "@flare/shared";
  import { toJpeg768 } from "#lib/photo.ts";

  let status = $state("Pick a photo of where you are.");
  let result: DraftResponseT | null = $state(null);
  let busy = $state(false);
  let bytes = $state(0);

  async function send(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    result = null;
    status = "Writing six words…";
    try {
      const jpeg = await toJpeg768(file);
      bytes = jpeg.size;
      const res = await fetch("/api/v1/drafts", { method: "POST", headers: { "content-type": "image/jpeg" }, body: jpeg });
      if (!res.ok) throw new Error(String(res.status));
      result = DraftResponse.parse(await res.json());
      status = result.tier === "hub" ? "Made on our laptop." : "Couldn't reach the laptop. Here's a template.";
    } catch {
      status = "That didn't send. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Flare hello</title></svelte:head>
<main>
  <h1>Hello, hub</h1>
  <label class="pick">
    <span>Choose photo</span>
    <input type="file" accept="image/*" capture="environment" onchange={send} disabled={busy} data-testid="photo" />
  </label>
  <p role="status" aria-live="polite" data-testid="status">{status}</p>
  {#if result}
    <p class="invite" data-testid="invite">{result.invite}</p>
    <p data-testid="alt">{result.alt}</p>
    <p class="meta" data-testid="meta">tier {result.tier} · {result.ms} ms · upload {Math.round(bytes / 1024)} KB</p>
  {/if}
</main>

<style>
  main { font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 20px; }
  .pick { display: inline-flex; min-height: 56px; align-items: center; padding: 0 22px; border-radius: 999px; background: #a93c12; color: #fbf8f2; font-weight: 700; }
  .pick input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .invite { font-size: 2rem; font-weight: 600; margin: 16px 0 4px; }
  .meta { color: #4a3f38; font-size: 0.9rem; }
</style>
