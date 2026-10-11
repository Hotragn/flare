// Voice Flare on the phone (ADR-0028). The host taps, says where they are and what they want to
// do (up to 10 s), and the clip goes once to POST /api/v1/drafts/voice, which relays it to Gemma 4
// on our laptop. The phone converts the recording to 16 kHz mono WAV first (what the hub's model
// takes), keeps nothing, and never sees the words heard: only the invite and the place line.
type DraftResponse = { invite: string; alt: string; tier: "hub" | "rules" | "cloud" };

export { startSpark as startVoice } from "./spark.ts";

/** Any recorded clip to 16 kHz mono 16-bit WAV. */
export async function toWav16k(clip: Blob): Promise<Blob> {
  const AC =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ac.decodeAudioData(await clip.arrayBuffer());
  } finally {
    void ac.close();
  }
  const rate = 16_000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  out.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i] ?? 0)) * 0x7fff, true);
  pcm.fill(0);
  return new Blob([out.buffer], { type: "audio/wav" });
}

/** The hub's draft, or null (hub away, nothing usable heard: the host types instead). */
export async function draftVoice(clip: Blob): Promise<{ invite: string; alt: string } | null> {
  try {
    const wav = await toWav16k(clip);
    const r = await fetch("/api/v1/drafts/voice", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: wav,
    });
    if (!r.ok) return null;
    const d = (await r.json()) as DraftResponse;
    return d.tier === "hub" && d.invite ? { invite: d.invite, alt: d.alt } : null;
  } catch {
    return null;
  }
}
