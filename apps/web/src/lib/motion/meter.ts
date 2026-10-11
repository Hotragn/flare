// Frame meter: requestAnimationFrame intervals, summarized. Used by /lab/fps and
// design/motion/bench.mjs. No dependencies; works in Safari and Chrome.
export type Summary = {
  frames: number;
  seconds: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  dropped: number;
  droppedPct: number;
  refreshHz: number;
};

export function summarize(dts: number[]): Summary {
  const s = [...dts].sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
  const total = dts.reduce((a, b) => a + b, 0);
  const med = q(0.5);
  const dropped = dts.filter((d) => d > med * 1.5).length;
  return {
    frames: dts.length,
    seconds: +(total / 1000).toFixed(2),
    fps: total ? +((dts.length * 1000) / total).toFixed(1) : 0,
    p50: +med.toFixed(2),
    p95: +q(0.95).toFixed(2),
    p99: +q(0.99).toFixed(2),
    dropped,
    droppedPct: dts.length ? +((100 * dropped) / dts.length).toFixed(1) : 0,
    refreshHz: refreshFrom(med),
  };
}

/** Nearest common refresh rate for a median frame interval (ms). 30 means Low Power Mode or a slow device. */
export function refreshFrom(medianMs: number) {
  if (!medianMs) return 0;
  const hz = 1000 / medianMs;
  return [30, 60, 90, 120, 144].reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
}

export class FrameMeter {
  dts: number[] = [];
  private prev = 0;
  private raf = 0;
  running = false;
  constructor(private keep = 1200) {}
  start() {
    if (this.running) return;
    this.running = true;
    this.prev = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      if (this.prev) {
        this.dts.push(now - this.prev);
        if (this.dts.length > this.keep) this.dts.shift();
      }
      this.prev = now;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  reset() {
    this.dts = [];
    this.prev = 0;
  }
  last(n: number) {
    return summarize(this.dts.slice(-n));
  }
}

/** gzip size in bytes using the browser's CompressionStream (Safari 16.4+, Chrome 80+). */
export async function gzipBytes(text: string): Promise<number | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

/** GPU name where the browser exposes it (Safari reports "Apple GPU"). */
export function gpuName(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "no WebGL";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const v = gl instanceof WebGL2RenderingContext ? "WebGL 2" : "WebGL 1";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return `${v}, ${name}`;
  } catch {
    return "unknown";
  }
}
