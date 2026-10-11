// Voice Spark (ADR-0027): a person may say their Spark instead of typing it. The phone records
// at most 10 s of that person's own voice, only after they hold the button; the server passes it
// to ElevenLabs Scribe, returns the words and zero-fills the audio. Nothing is stored or logged;
// the words go back to the phone, which seals the Spark as usual. Off without ELEVENLABS_API_KEY.
// Never used for anyone else's voice or for a conversation.

export const SCRIBE_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
export const SCRIBE_MODEL = "scribe_v2";
export const MAX_SPARK_AUDIO_BYTES = 400_000; // 10 s of Opus or AAC is about 20 to 160 KB
export const SPARK_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/wav"];
const BUDGET_MS = 15_000;

export type VoiceTier = {
  transcribe(audio: Uint8Array, type: string): Promise<string | null>;
  /** Transcriptions left today under the server's cap. */
  left(): number;
};

export function voiceTier(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): VoiceTier | null {
  const key = env.ELEVENLABS_API_KEY ?? "";
  if (!key) return null;
  const cap = Number(env.VOICE_SPARK_DAILY_MAX ?? 40);
  let day = "";
  let used = 0;
  const today = () => new Date().toISOString().slice(0, 10);
  return {
    left: () => Math.max(0, cap - (day === today() ? used : 0)),
    async transcribe(audio, type) {
      if (day !== today()) {
        day = today();
        used = 0;
      }
      if (used >= cap) return null;
      used++;
      const fd = new FormData();
      fd.append("model_id", SCRIBE_MODEL);
      fd.append("language_code", "en");
      fd.append("tag_audio_events", "false");
      fd.append("file", new Blob([audio as Uint8Array<ArrayBuffer>], { type }), "spark");
      try {
        const r = await fetchImpl(SCRIBE_ENDPOINT, {
          method: "POST",
          headers: { "xi-api-key": key },
          body: fd,
          signal: AbortSignal.timeout(BUDGET_MS),
        });
        if (!r.ok) return null;
        const j = (await r.json()) as { text?: string };
        const text = (j.text ?? "").replace(/\s+/g, " ").trim();
        return text ? text.slice(0, 140) : null;
      } catch {
        return null;
      }
    },
  };
}
