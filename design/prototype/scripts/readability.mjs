// Flesch-Kincaid grade level, small and dependency-free.
//   grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
// Syllables use a vowel-group count with common English corrections. Numbers and
// units ("40", "m", "PM") count as 1 syllable, since they're read at a glance.
// Usage as a CLI: node scripts/readability.mjs "Some text to grade."
import { fileURLToPath } from "node:url";

const WORD = /[A-Za-z0-9][A-Za-z0-9'’.-]*/g;

export function syllables(word) {
  let w = word.toLowerCase().replace(/[’']/g, "").replace(/[^a-z]/g, "");
  if (!w) return 1; // a number
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$/, (m) => m[0]); // silent endings: "makes", "named", "make" ("created" keeps -ed)
  w = w.replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  const n = groups ? groups.length : 1;
  return Math.max(1, n);
}

export function words(text) {
  return (text.match(WORD) ?? []).map((w) => w.replace(/[.]+$/, ""));
}

export function sentences(text) {
  const parts = text.split(/(?<=[.?!…])\s+|\n+/).map((s) => s.trim()).filter((s) => words(s).length > 0);
  return Math.max(1, parts.length);
}

export function fkGrade(text) {
  const ws = words(text);
  if (!ws.length) return 0;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  return 0.39 * (ws.length / sentences(text)) + 11.8 * (syl / ws.length) - 15.59;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = process.argv.slice(2).join(" ");
  const g = fkGrade(text);
  console.log(`words ${words(text).length}, sentences ${sentences(text)}, grade ${g.toFixed(1)}`);
}
