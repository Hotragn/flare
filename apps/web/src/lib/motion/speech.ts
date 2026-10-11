// Compass speech cadence, SRS-CMP-2: speak again when the bearing changes by 30° or
// more, the distance halves, or 60 s pass. Also when the line itself changes to or
// from "straight ahead" (locking on is news).
export type Spoken = { text: string; bearing: number; meters: number; at: number };

export function speechDue(prev: Spoken | null, now: Spoken): boolean {
  if (!prev) return true;
  const turn = Math.abs(((now.bearing - prev.bearing + 540) % 360) - 180);
  if (turn >= 30) return true;
  if (now.meters <= prev.meters / 2) return true;
  if (now.at - prev.at >= 60000) return true;
  const ahead = (t: string) => t.includes("straight ahead");
  return ahead(now.text) !== ahead(prev.text);
}
