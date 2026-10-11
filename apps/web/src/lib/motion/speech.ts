// Compass speech cadence, SRS-CMP-2: speak again when the bearing changes by 30° or
// more, the distance halves, or 60 s pass. Also when the line itself changes to or
// from "straight ahead" (locking on is news).
export const HALVING_FROM_M = 20;
export type Spoken = { text: string; bearing: number; meters: number; at: number };

export function speechDue(prev: Spoken | null, now: Spoken): boolean {
  if (!prev) return true;
  const turn = Math.abs(((now.bearing - prev.bearing + 540) % 360) - 180);
  if (turn >= 30) return true;
  // Halving matters on the walk, not inside GPS error (1.3 m to 0.5 m is not news).
  if (prev.meters >= HALVING_FROM_M && now.meters <= prev.meters / 2) return true;
  if (now.at - prev.at >= 60000) return true;
  const ahead = (t: string) => t.includes("straight ahead");
  return ahead(now.text) !== ahead(prev.text);
}
