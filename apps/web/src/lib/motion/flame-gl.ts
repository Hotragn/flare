// WebGL flame renderer. One small canvas per flame, a shared mask texture made
// from the brand paths, and uniforms that tween between states on the motion
// tokens. The Flame component decides when to use it (see canUseWebGL and
// acquireSlot) and falls back to the SVG/CSS flame on any failure.
import { DOME, FLAME, type FlameState, HOLE, ring } from "#lib/brand.ts";
import { DUR, EASE } from "./core.ts";
import { FRAG, VERT } from "./flame-shader.ts";

const TEX = 512; // mask texture size (px) for the 140 x 140 brand-unit area

// ---------- capability and slots ----------
let glOk: boolean | null = null;
/** True when this browser can create a WebGL context and compile the flame shader. */
export function canUseWebGL(): boolean {
  if (glOk !== null) return glOk;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    glOk = !!gl && !!compile(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    glOk = false;
  }
  return glOk;
}

/** Browsers cap live WebGL contexts (Chrome 16; iOS Safari is lower in practice). We keep at most 4. */
export const MAX_LIVE = 4;
let live = 0;
export function acquireSlot() {
  if (live >= MAX_LIVE) return false;
  live++;
  return true;
}
export function releaseSlot() {
  live = Math.max(0, live - 1);
}
export const liveCount = () => live;

// ---------- mask texture (built once per page, 1 MB, shared by every flame) ----------
// One 2D canvas pass draws the three brand shapes into r, g and b (additive), so there is
// one readback. The wide glow (a) is blurred on a 128 px copy and scaled up, which keeps
// the one-time build short (measured in /lab/fps and docs/design/motion.md).
let mask: Uint8Array | null = null;
export let maskBuildMs = 0;

/** In-place box blur on one channel of a w x w Float32Array, `passes` times (3 passes ~ Gaussian). */
function blur(ch: Float32Array, w: number, r: number, passes: number) {
  const tmp = new Float32Array(ch.length);
  const norm = 1 / (2 * r + 1);
  const run = (src: Float32Array, dst: Float32Array, stride: number, step: number) => {
    for (let line = 0; line < w; line++) {
      const o = line * stride;
      let acc = src[o] * (r + 1);
      for (let i = 1; i <= r; i++) acc += src[o + Math.min(w - 1, i) * step];
      for (let i = 0; i < w; i++) {
        dst[o + i * step] = acc * norm;
        acc += src[o + Math.min(w - 1, i + r + 1) * step] - src[o + Math.max(0, i - r) * step];
      }
    }
  };
  for (let k = 0; k < passes; k++) {
    run(ch, tmp, w, 1);
    run(tmp, ch, 1, w);
  }
}

function draw(size: number, paint: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  const k = size / 140;
  x.setTransform(k, 0, 0, k, 20 * k, 30 * k);
  paint(x);
  return x.getImageData(0, 0, size, size).data;
}

function buildMask() {
  if (mask) return mask;
  const t0 = performance.now();
  const flame = new Path2D(`${FLAME} ${ring(HOLE.cx, HOLE.cy, HOLE.r)}`);
  const d = draw(TEX, (x) => {
    // Opaque black first, so each channel's value is the shape's coverage (no unpremultiply).
    x.fillStyle = "#000";
    x.fillRect(-20, -30, 140, 140);
    x.globalCompositeOperation = "lighter";
    x.fillStyle = "#f00";
    x.fill(flame, "evenodd");
    x.fillStyle = "#0f0";
    x.fill(new Path2D(`${DOME} ${ring(50, 81, 8)}`), "evenodd");
    // The Gone mark from brand/logo: dashed ring and a rising smoke line.
    x.strokeStyle = "#00f";
    x.lineCap = "round";
    x.globalAlpha = 0.7;
    x.lineWidth = 3;
    x.setLineDash([3.2, 3.2]);
    x.beginPath();
    x.arc(50, 86, 7, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    x.globalAlpha = 1;
    x.lineWidth = 5;
    x.stroke(new Path2D("M50 76 C41 67 59 60 51 49 C45 40 58 33 61 22"));
    x.globalAlpha = 0.5;
    x.lineWidth = 4;
    x.stroke(new Path2D("M66 18 C70 13 67 8 72 3"));
  });
  const n = TEX * TEX;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    ch[0][i] = d[i * 4] / 255;
    ch[1][i] = d[i * 4 + 1] / 255;
    ch[2][i] = d[i * 4 + 2] / 255;
  }
  for (const c of ch) blur(c, TEX, 1, 1);
  // Wide glow: 128 px copy, radius 4 (about 14 texels at full size), 3 passes.
  const L = 128;
  const dl = draw(L, (x) => {
    x.fillStyle = "#fff";
    x.fill(flame, "evenodd");
  });
  const lo = new Float32Array(L * L);
  for (let i = 0; i < lo.length; i++) lo[i] = dl[i * 4 + 3] / 255;
  blur(lo, L, 4, 3);
  mask = new Uint8Array(n * 4);
  const f = (L - 1) / (TEX - 1);
  for (let y = 0; y < TEX; y++) {
    const sy = y * f,
      y0 = sy | 0,
      y1 = Math.min(L - 1, y0 + 1),
      ty = sy - y0;
    for (let x = 0; x < TEX; x++) {
      const sx = x * f,
        x0 = sx | 0,
        x1 = Math.min(L - 1, x0 + 1),
        tx = sx - x0;
      const a =
        (lo[y0 * L + x0] * (1 - tx) + lo[y0 * L + x1] * tx) * (1 - ty) +
        (lo[y1 * L + x0] * (1 - tx) + lo[y1 * L + x1] * tx) * ty;
      const i = y * TEX + x,
        o = i * 4;
      mask[o] = ch[0][i] * 255;
      mask[o + 1] = ch[1][i] * 255;
      mask[o + 2] = ch[2][i] * 255;
      mask[o + 3] = Math.min(1, a * 1.15) * 255;
    }
  }
  maskBuildMs = performance.now() - t0;
  return mask;
}

// ---------- GL setup ----------
function compile(gl: WebGLRenderingContext) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

// ---------- tweens ----------
type Ease = (x: number) => number;
type Tween = { from: number; to: number; start: number; dur: number; ease: Ease; bump?: boolean };
const KEYS = ["sc", "sy", "heat", "lit", "pulse", "emb", "dome", "gone", "drift"] as const;
type Key = (typeof KEYS)[number];
type Vals = Record<Key, number>;
const bumpShape: Ease = (x) => Math.sin(Math.PI * Math.min(1, Math.max(0, x)));

/** Uniform targets for each state. Kindling size grows 55% to 90% with progress. */
export function targetFor(state: FlameState, progress: number): Vals {
  const sc = 0.55 + 0.35 * Math.min(1, Math.max(0, progress));
  switch (state) {
    case "kindling":
      return { sc, sy: 1, heat: 0.65, lit: 0, pulse: 0, emb: 0, dome: 1, gone: 0, drift: 1 };
    case "lit":
      return { sc: 1, sy: 1, heat: 1, lit: 1, pulse: 0, emb: 0, dome: 1, gone: 0, drift: 1 };
    case "ember":
      return { sc: 1, sy: 0.45, heat: 0.3, lit: 0, pulse: 0, emb: 1, dome: 1, gone: 0, drift: 1 };
    case "gone":
      return { sc: 1, sy: 0.45, heat: 0, lit: 0, pulse: 0, emb: 1, dome: 1, gone: 1, drift: 0 };
  }
}

export type Rgb = [number, number, number];
export function parseColor(v: string): Rgb | null {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(/[ ,/]+/).map(Number);
    return [r / 255, g / 255, b / 255];
  }
  return null;
}

export type FrameStats = { frames: number; dts: number[]; drawMs: number[]; dpr: number; downgrades: string[] };

export class FlameGL {
  private gl: WebGLRenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private cur: Vals;
  private tw: Partial<Record<Key, Tween>> = {};
  private colors: Record<"cB" | "cE" | "cS" | "cD", Rgb> = {
    cB: [0.85, 0.33, 0.12],
    cE: [0.62, 0.17, 0.09],
    cS: [0.44, 0.47, 0.53],
    cD: [0.97, 0.75, 0.33],
  };
  private colorFrom: Rgb = [0, 0, 0];
  private colorTo: Rgb = [0, 0, 0];
  private colorStart = 0;
  private raf = 0;
  private running = false;
  private visible = true;
  private prevT = 0;
  private io: IntersectionObserver | null = null;
  private baseline = Infinity;
  private dprCap: number;
  private stateAt = 0;
  stats: FrameStats;
  state: FlameState;

  constructor(
    private canvas: HTMLCanvasElement,
    private cssSize: number,
    init: { state: FlameState; progress: number; dprCap?: number },
    private onFail: (why: string) => void,
  ) {
    this.dprCap = init.dprCap ?? 2;
    const gl = (canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    }) ||
      canvas.getContext("webgl", {
        premultipliedAlpha: true,
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      })) as WebGLRenderingContext | null;
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    const prog = compile(gl);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const k of ["M", "t", "edge", "cB", "cE", "cS", "cD", ...KEYS]) this.u[k] = gl.getUniformLocation(prog, k);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEX, TEX, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildMask());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u.M, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    canvas.addEventListener("webglcontextlost", this.lost);
    this.state = init.state;
    this.cur = targetFor(init.state, init.progress);
    this.stats = { frames: 0, dts: [], drawMs: [], dpr: 0, downgrades: [] };
    this.resize();
    this.readColors(true);
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((e) => {
        this.visible = e[0]?.isIntersecting ?? true;
        this.kick();
      });
      this.io.observe(canvas);
    }
    document.addEventListener("visibilitychange", this.kick);
    this.kick();
  }

  private lost = (e: Event) => {
    e.preventDefault();
    this.destroy();
    this.onFail("context lost");
  };

  resize() {
    const dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    const px = Math.round(this.cssSize * 1.4 * dpr);
    if (this.canvas.width !== px) {
      this.canvas.width = this.canvas.height = px;
    }
    this.stats.dpr = dpr;
    // Edge softness in mask units: about one device pixel wide.
    const texPerPx = TEX / px;
    this.gl.uniform1f(this.u.edge, Math.min(0.45, Math.max(0.05, texPerPx * 0.17)));
  }

  setDprCap(cap: number) {
    this.dprCap = cap;
    this.resize();
  }

  /** Reads the state colors from the CSS role variables, so themes and sun mode apply. */
  readColors(instant = false) {
    const cs = getComputedStyle(this.canvas);
    const get = (n: string, fb: Rgb) => parseColor(cs.getPropertyValue(n)) ?? fb;
    const body = get(this.state === "kindling" ? "--kindling" : "--lit", this.colors.cB);
    this.colors.cE = get("--ember", this.colors.cE);
    this.colors.cS = get("--gone", this.colors.cS);
    this.colors.cD = get("--c-gold-400", this.colors.cD);
    this.colorFrom = instant ? body : [...this.colors.cB];
    this.colorTo = body;
    this.colorStart = performance.now();
  }

  private tween(k: Key, to: number, dur: number, ease: Ease, delay = 0, from = this.cur[k], bump = false) {
    this.tw[k] = { from, to, start: performance.now() + delay, dur: Math.max(1, dur), ease, bump };
  }

  /** Move to a state with the motion spec for that change (docs/design/motion.md, section 3). */
  setState(next: FlameState, progress: number, opts: { intro?: boolean } = {}) {
    const prev = this.state;
    const tgt = targetFor(next, progress);
    if (opts.intro) {
      // Start from where this state would come from, then play the change.
      const fromState: FlameState =
        next === "lit" ? "kindling" : next === "ember" ? "lit" : next === "gone" ? "ember" : "kindling";
      this.cur = targetFor(fromState, next === "lit" ? 1 : Math.max(0, progress - 0.25));
      this.state = fromState;
    }
    const from = this.state;
    this.state = next;
    this.stateAt = performance.now();
    const { base, slow, quick, drift } = DUR;
    if (next === "kindling") {
      // Yes lands: one step bigger, spring overshoot, small glow lift.
      this.tween("sc", tgt.sc, base, EASE.spring);
      this.tween("pulse", 0.35, base, bumpShape, 0, 0, true);
      for (const k of ["sy", "heat", "lit", "emb", "dome", "gone", "drift"] as Key[])
        this.tween(k, tgt[k], base, EASE.out);
    } else if (next === "lit") {
      // Catch: grow to full (480 ms spring), dot lights gold at 160 ms, one pulse.
      this.tween("sc", 1, slow, EASE.spring);
      this.tween("heat", 1, base, EASE.out);
      this.tween("lit", 1, quick, EASE.out, quick);
      this.tween("pulse", 1, slow - quick, bumpShape, quick, 0, true);
      for (const k of ["sy", "emb", "dome", "gone", "drift"] as Key[]) this.tween(k, tgt[k], base, EASE.out);
    } else if (next === "ember") {
      // Settle: the flame sinks into the dome; the dome lands with a soft settle.
      // The flame sinks first (ease-out), and fades as it reaches the dome (ease-in).
      this.tween("emb", 1, slow, EASE.in);
      this.tween("sy", tgt.sy, slow, EASE.out);
      this.tween("dome", 1, slow, EASE.settle, 0, from === "ember" ? 1 : 1.6);
      this.tween("heat", tgt.heat, slow, EASE.out);
      this.tween("lit", 0, quick, EASE.out);
      this.tween("gone", 0, quick, EASE.out);
      this.tween("drift", 1, quick, EASE.out);
    } else {
      // Gone: smoke drifts up and right while it fades in, 900 ms.
      this.tween("gone", 1, quick, EASE.linear, 0, 0);
      this.tween("drift", 0, drift, EASE.out, 0, 1);
      this.tween("emb", 1, base, EASE.out);
      this.tween("heat", 0, base, EASE.out);
      this.tween("lit", 0, quick, EASE.out);
    }
    if (prev !== next || opts.intro) this.readColors();
    this.kick();
  }

  private value(k: Key, now: number) {
    const t = this.tw[k];
    if (!t) return this.cur[k];
    const x = (now - t.start) / t.dur;
    if (x < 0) return t.bump ? 0 : t.from;
    if (x >= 1) {
      delete this.tw[k];
      this.cur[k] = t.bump ? 0 : t.to;
      return this.cur[k];
    }
    const e = t.ease(x);
    this.cur[k] = t.bump ? t.to * e : t.from + (t.to - t.from) * e;
    return this.cur[k];
  }

  private kick = () => {
    const want = this.visible && !document.hidden;
    if (want && !this.running) {
      this.running = true;
      this.prevT = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
    if (!want && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  };

  private frame = (now: number) => {
    if (!this.running) return;
    const t0 = performance.now();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.u.t, (now / 1000) % 1000);
    for (const k of KEYS) gl.uniform1f(this.u[k], this.value(k, now));
    const cx = Math.min(1, (now - this.colorStart) / DUR.base);
    const body = this.colorFrom.map((c, i) => c + (this.colorTo[i] - c) * EASE.out(cx)) as Rgb;
    this.colors.cB = body;
    for (const [k, c] of Object.entries(this.colors)) gl.uniform3f(this.u[k], c[0], c[1], c[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const s = this.stats;
    s.drawMs.push(performance.now() - t0);
    if (this.prevT) s.dts.push(now - this.prevT);
    this.prevT = now;
    s.frames++;
    if (s.dts.length > 600) {
      s.dts.splice(0, 300);
      s.drawMs.splice(0, 300);
    }
    // Gone is still: after the drift and 1.5 s of slow smoke, keep the last frame and stop drawing.
    if (this.state === "gone" && !Object.keys(this.tw).length && now - this.stateAt > DUR.drift + 1500) {
      this.running = false;
      return;
    }
    if (s.frames % 120 === 0) this.checkSlow();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Auto-downgrade: more than 10% late frames in the last 2 s drops DPR to 1, then to CSS. */
  private checkSlow() {
    const w = this.stats.dts.slice(-120).sort((a, b) => a - b);
    if (w.length < 100) return;
    const med = w[w.length >> 1];
    this.baseline = Math.min(this.baseline, med);
    const late = w.filter((d) => d > this.baseline * 1.5).length / w.length;
    if (late <= 0.1) return;
    if (this.dprCap > 1) {
      this.stats.downgrades.push(`dpr ${this.dprCap} to 1 (${Math.round(late * 100)}% late)`);
      this.setDprCap(1);
      return;
    }
    this.stats.downgrades.push(`webgl to css (${Math.round(late * 100)}% late)`);
    this.destroy();
    this.onFail("slow");
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    document.removeEventListener("visibilitychange", this.kick);
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
