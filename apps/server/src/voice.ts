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

export type ConversationLine = { speaker: string; text: string };
export const MAX_REMEMBER_AUDIO_BYTES = 1_200_000; // 60 s of Opus or AAC is about 0.2 to 1 MB

export type VoiceTier = {
  transcribe(audio: Uint8Array, type: string): Promise<string | null>;
  /** Remember this (ADR-0031): up to 60 s, speaker labels only (Speaker 1, 2...), no names. */
  conversation(audio: Uint8Array, type: string): Promise<ConversationLine[] | null>;
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
    async conversation(audio, type) {
      if (day !== today()) {
        day = today();
        used = 0;
      }
      if (used >= cap) return null;
      used++;
      const fd = new FormData();
      fd.append("model_id", SCRIBE_MODEL);
      fd.append("diarize", "true");
      fd.append("tag_audio_events", "false");
      fd.append("timestamps_granularity", "word");
      fd.append("file", new Blob([audio as Uint8Array<ArrayBuffer>], { type }), "remember");
      try {
        const r = await fetchImpl(SCRIBE_ENDPOINT, {
          method: "POST",
          headers: { "xi-api-key": key },
          body: fd,
          signal: AbortSignal.timeout(30_000),
        });
        if (!r.ok) return null;
        const j = (await r.json()) as {
          words?: { text?: string; type?: string; speaker_id?: string }[];
          text?: string;
        };
        return toLines(j.words ?? [], j.text ?? "");
      } catch {
        return null;
      }
    },
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

/** Words to lines by speaker, in order; the speaker ids become "Speaker 1", "Speaker 2"... */
export function toLines(
  words: { text?: string; type?: string; speaker_id?: string }[],
  fallback: string,
): ConversationLine[] {
  const label = new Map<string, string>();
  const lines: ConversationLine[] = [];
  for (const w of words) {
    if (w.type === "audio_event") continue;
    const id = w.speaker_id ?? "speaker_0";
    if (!label.has(id)) label.set(id, `Speaker ${label.size + 1}`);
    const speaker = label.get(id) as string;
    const last = lines[lines.length - 1];
    if (last && last.speaker === speaker) last.text += w.text ?? "";
    else if ((w.text ?? "").trim()) lines.push({ speaker, text: (w.text ?? "").trimStart() });
  }
  const out = lines
    .map((l) => ({ speaker: l.speaker, text: l.text.replace(/\s+/g, " ").trim().slice(0, 600) }))
    .filter((l) => l.text);
  if (!out.length && fallback.trim()) return [{ speaker: "Speaker 1", text: fallback.trim().slice(0, 600) }];
  return out.slice(0, 40);
}
