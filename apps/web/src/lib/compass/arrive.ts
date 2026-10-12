// Automatic "I'm here" (ADR-0030 addendum): when Find them shows you within 30 m of the spot,
// with a good GPS fix (accuracy 20 m or better), on two fixes in a row, the phone offers to mark
// you here with a 10 s Undo. Only while the page is open and the compass is running; no
// background location. Pure, so it is tested on the recorded iPhone streams.

export const ARRIVE_M = 30;
export const ARRIVE_ACCURACY_M = 20;
export const ARRIVE_FIXES = 2;
export const UNDO_MS = 10_000;

export type Arrival = { fix(distanceM: number | null, accuracyM: number | null): boolean; reset(): void };

export function createArrival(o: { radiusM?: number; accuracyM?: number; fixes?: number } = {}): Arrival {
  const r = o.radiusM ?? ARRIVE_M;
  const a = o.accuracyM ?? ARRIVE_ACCURACY_M;
  const need = o.fixes ?? ARRIVE_FIXES;
  let run = 0;
  let fired = false;
  return {
    fix(d, acc) {
      if (fired) return false;
      const good = d !== null && acc !== null && d <= r && acc <= a;
      run = good ? run + 1 : 0;
      if (run >= need) {
        fired = true;
        return true;
      }
      return false;
    },
    reset() {
      run = 0;
      fired = false;
    },
  };
}
