// Synthesizes Flare's sounds from scratch (no samples, no third-party audio) and
// writes 16-bit mono WAV files. It also encodes AAC .m4a copies with macOS
// `afconvert` (when present) and keeps them only where they are much smaller. Prints a mixing table (peak and RMS in dBFS, measured from the samples).
// Usage: node design/motion/make-sounds.mjs   (writes design/prototype/static/sounds/)
// The random generator is seeded, so every run makes byte-identical WAV files.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../prototype/static/sounds");
const SR = 24000; // 12 kHz bandwidth is plenty for these sounds and halves the size
fs.mkdirSync(OUT, { recursive: true });

// ---------- building blocks ----------
let seed = 20261010;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = (sec) => new Float64Array(Math.round(sec * SR));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d)); // linear attack, exponential decay
// RBJ biquad filters
function biquad(x, type, f, q) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // band-pass, 0 dB peak
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
function normalize(x, dbfs) { const g = 10 ** (dbfs / 20) / peakOf(x); return x.map((v) => v * g); }
function fadeEdges(x, ms = 3) { const n = Math.round((ms / 1000) * SR); for (let i = 0; i < n; i++) { x[i] *= i / n; x[x.length - 1 - i] *= i / n; } return x; }

// ---------- the sounds ----------
// 1. yes: a small dry tick, like a twig. Band-passed noise snap plus a short wooden knock.
function yes() {
  const x = buf(0.07);
  const snap = biquad(x.map((_, i) => rand() * env(i / SR, 0.0004, 0.004)), "bp", 3200, 1.4);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const knock = Math.sin(2 * Math.PI * 1650 * t) * env(t, 0.0006, 0.009) * 0.5 + Math.sin(2 * Math.PI * 2900 * t) * env(t, 0.0003, 0.004) * 0.25;
    x[i] = snap[i] * 2.2 + knock;
  }
  return normalize(fadeEdges(biquad(x, "hp", 500, 0.7), 2), -6);
}

// 2. lit: a low warm whump, 520 ms. A pitch drop from 150 to 58 Hz for weight on headphones,
// with 2nd and 3rd harmonics and a 250 Hz noise breath so phone speakers (weak below ~300 Hz) still carry it.
function lit() {
  const x = buf(0.52);
  const breath = biquad(biquad(x.map((_, i) => rand() * env(i / SR, 0.03, 0.07)), "lp", 420, 0.8), "hp", 120, 0.7);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = 58 + 92 * Math.exp(-t / 0.07);
    ph += (2 * Math.PI * f) / SR;
    const e = env(t, 0.012, 0.13);
    const body = Math.sin(ph) + 0.45 * Math.sin(2 * ph + 0.3) + 0.22 * Math.sin(3 * ph + 0.7);
    x[i] = body * e * 0.8 + breath[i] * 3.0;
  }
  return normalize(fadeEdges(x, 6), -3);
}

// 3. ember: a soft low note, 700 ms. A3 (220 Hz) with a quiet octave and a slightly detuned
// partial for warmth; slow 40 ms attack so it reads as calm, not as an alert.
function ember() {
  const x = buf(0.7);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const e = env(t, 0.04, 0.2);
    x[i] = e * (Math.sin(2 * Math.PI * 220 * t) + 0.3 * Math.sin(2 * Math.PI * 440.8 * t) + 0.12 * Math.sin(2 * Math.PI * 661 * t + 1));
  }
  return normalize(fadeEdges(x, 8), -9);
}

// 4. facing: a short clear tone when the compass locks on, 140 ms. B5 (988 Hz) with a soft fifth.
// Plays where the phone cannot vibrate (SRS-CMP-3).
function facing() {
  const x = buf(0.14);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const e = env(t, 0.004, 0.035);
    x[i] = e * (Math.sin(2 * Math.PI * 988 * t) + 0.25 * Math.sin(2 * Math.PI * 1482 * t));
  }
  return normalize(fadeEdges(x, 3), -10);
}

// ---------- write and measure ----------
function wav(x) {
  const data = Buffer.alloc(x.length * 2);
  x.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
function measure(x) {
  const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
  const win = Math.round(0.05 * SR); // loudest 50 ms window
  let best = 0;
  for (let i = 0; i + win <= x.length; i += Math.round(win / 4)) {
    let s = 0; for (let j = i; j < i + win; j++) s += x[j] * x[j];
    best = Math.max(best, Math.sqrt(s / win));
  }
  return { peak: db(peakOf(x)), rms: db(rms), rms50: db(best) };
}

const sounds = { yes: yes(), lit: lit(), ember: ember(), facing: facing() };
let hasAfconvert = true;
try { execFileSync("afconvert", ["-h"], { stdio: "ignore" }); } catch (e) { hasAfconvert = e.code !== "ENOENT"; }
const rows = [];
for (const [name, x] of Object.entries(sounds)) {
  const w = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(w, wav(x));
  let m4a = null;
  if (hasAfconvert) {
    // AAC ships only when it is under 60% of the WAV size. For the two short sounds it is
    // bigger than WAV and adds encoder priming before the sound (docs/design/motion.md, section 5).
    const tmp = path.join(os.tmpdir(), `flare-${name}.m4a`);
    try { execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", w, tmp], { stdio: "ignore" }); m4a = fs.statSync(tmp).size; } catch { m4a = null; }
    if (m4a && m4a < 0.6 * fs.statSync(w).size) fs.copyFileSync(tmp, path.join(OUT, `${name}.m4a`));
    else fs.rmSync(path.join(OUT, `${name}.m4a`), { force: true });
  }
  const m = measure(x);
  rows.push({ name, ms: Math.round((x.length / SR) * 1000), peak: m.peak.toFixed(1), rms: m.rms.toFixed(1), rms50: m.rms50.toFixed(1), wavBytes: fs.statSync(w).size, m4aBytes: m4a });
}
fs.writeFileSync(path.join(HERE, "sounds.json"), JSON.stringify({ sampleRate: SR, bits: 16, channels: 1, sounds: rows }, null, 2) + "\n");
console.log("| Sound | Length ms | Peak dBFS | RMS dBFS | Loudest 50 ms RMS dBFS | WAV bytes | M4A bytes |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) console.log(`| ${r.name} | ${r.ms} | ${r.peak} | ${r.rms} | ${r.rms50} | ${r.wavBytes} | ${r.m4aBytes ?? "n/a"} |`);
