// Render's free tier sleeps the server after 15 minutes idle; the first request then waits
// 30 to 60 s while it boots (ADR-0005 amended). The app shell loads from the service worker,
// so the screen is there but the request hangs. Any request slower than 4 s raises this flag
// and every Screen shows "Waking up the server" until the slow requests finish.
export const SLOW_MS = 4000;
export const net = $state({ slow: 0 });

export async function timed<T>(p: Promise<T>, slowMs = SLOW_MS): Promise<T> {
  let counted = false;
  const h = setTimeout(() => {
    counted = true;
    net.slow++;
  }, slowMs);
  try {
    return await p;
  } finally {
    clearTimeout(h);
    if (counted) net.slow--;
  }
}
