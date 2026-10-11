// Voice Spark on the phone (ADR-0027). Records only while the person has tapped "Say it", stops
// at 10 s, sends the clip once to POST /api/v1/voice/spark, and keeps nothing: the Blob is
// dropped after the call and the microphone is released at once. The words come back for the
// person to edit before the Spark is sealed as usual.

export const SPARK_MAX_MS = 10_000;
let on: Promise<boolean> | null = null;

/** The server has Scribe and this browser can record. */
export function sparkVoiceOn(): Promise<boolean> {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(false);
  on ??= fetch("/api/v1/config")
    .then((r) => (r.ok ? r.json() : null))
    .then((c: { voice?: { spark?: boolean } } | null) => !!c?.voice?.spark)
    .catch(() => false);
  return on;
}

const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

export type Recording = { stop(): void; done: Promise<Blob | null> };

/** Starts the microphone; resolves with the clip when stopped or at 10 s. */
export async function startSpark(maxMs = SPARK_MAX_MS): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const done = new Promise<Blob | null>((resolve) => {
    rec.onstop = () => {
      for (const t of stream.getTracks()) t.stop(); // the mic light goes off now
      const type = (rec.mimeType || "audio/webm").split(";")[0] ?? "audio/webm";
      resolve(parts.length ? new Blob(parts, { type }) : null);
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state !== "inactive" && rec.stop(), maxMs);
  return {
    stop() {
      clearTimeout(timer);
      if (rec.state !== "inactive") rec.stop();
    },
    done,
  };
}

/** The words, or null (the person types instead). */
export async function transcribeSpark(clip: Blob): Promise<string | null> {
  try {
    const r = await fetch("/api/v1/voice/spark", {
      method: "POST",
      headers: { "content-type": clip.type },
      body: clip,
    });
    if (!r.ok) return null;
    return ((await r.json()) as { text: string | null }).text;
  } catch {
    return null;
  }
}
