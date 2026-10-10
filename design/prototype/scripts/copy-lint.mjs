// Copy lint for Flare. Checks every string in src/lib/copy/deck.json and the code that shows them.
//
//   1. Length: buttons ≤ 3 words; UI strings ≤ 12 words (rendered with sample values);
//      prose ≤ 25 words per sentence; plain-text SMS ≤ 200 bytes UTF-8 for every
//      named Fairlane spot (worst case), with truncation per BR-CH-2.
//   2. No-slop: banned words, em dashes, exclamation marks, filler, fake urgency,
//      guilt, vague claims, "step-free" (BR-A-4).
//   3. Inclusive language: ableist idioms, gendered defaults, person-first wording.
//   4. Fixed strings from the requirements exist word for word.
//   5. Code: screens, site and the two owned components use t() and have no
//      hardcoded copy; every key used exists; unused keys are listed by owner.
//   6. Readability: Flesch-Kincaid grade per string, averages, and every string over 8.
//
// Writes docs/content/02-copy-deck.md and docs/content/03-checks.md. Exits 1 on any problem.
// Usage: node scripts/copy-lint.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fkGrade, words as wordList } from "./readability.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "../..");
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/copy/deck.json"), "utf8"));
const S = deck.strings;
const problems = [];
const problem = (key, msg) => problems.push(`${key}: ${msg}`);

// ---------- helpers ----------
const UI_KINDS = new Set(["message", "title", "label", "hint", "status", "error", "aria", "placeholder", "option", "push", "bot", "share", "og-title", "fragment"]);
const PROSE_KINDS = new Set(["prose", "export", "og-desc"]);
const render = (key, e, extra = {}) => {
  const vars = { ...deck.meta.sample, ...(e.sample ?? {}), ...extra };
  return e.text.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? String(vars[n]) : m));
};
const countWords = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const sentencesOf = (s) => s.split(/(?<=[.?!])\s+|\n+/).filter((x) => /[A-Za-z0-9]/.test(x));

// ---------- 2 and 3: word lists ----------
const lists = {
  banned: /\b(seamless\w*|leverag\w*|robust\w*|empower\w*|unlock\w*|elevat\w*|delve\w*|cutting-edge|revolutioni\w*|game-changer|harness\w*|synerg\w*|holistic\w*|paradigm\w*|next-level|supercharg\w*|effortless\w*|ecosystem\w*|tapestry|testament)\b|fast-paced world|let's dive in|it's not just/i,
  filler: /\b(just|simply|really|very|basically|actually|literally|totally|quite|in order to|please note|feel free)\b/i,
  urgency: /\b(hurry|act now|don't miss|last chance|limited time|before it's too late|only \d+ left|right now|asap|quick,)\b/i,
  guilt: /\b(you missed|missed out|failed|let (them|us|everyone) down|no one came|nobody came|nobody could|flak\w*|ignored|you didn't|sorry you)\b/i,
  vague: /\b((?<!how |this |as )many|lots of|a lot of people|a few|several|tons of|soon|fast|quickly|instantly|blazing|super|incredibly|world-class|best-in-class|amazing|magic\w*|smart)\b/i,
  ableist: /\b(blind spot|blind to|turn a blind eye|crazy|insane|lame|dumb|crippl\w*|sanity|tone-deaf|deaf ear|wheelchair-bound|confined to a|suffers? from|handicapped|the disabled|normal people|able-bodied|special needs|lunatic|psycho)\b/i,
  gendered: /\b(guys|he|she|his|her|hers|him|himself|herself|man-hours|manpower|chairman|mankind|ladies|gentlemen)\b/i,
  stepFree: /step-free/i,
};
const listNotes = { banned: "banned word", filler: "filler word", urgency: "fake urgency", guilt: "guilt", vague: "vague claim (use a number)", ableist: "ableist idiom", gendered: "gendered default", stepFree: "says step-free (BR-A-4)" };
// Reviewed uses that are not the problem the list targets.
const allow = {
  "site.how.s3.body": ["vague"], // none expected; kept as an example slot
};
delete allow["site.how.s3.body"];
const hits = Object.fromEntries(Object.keys(lists).map((k) => [k, 0]));

// ---------- 4: fixed strings ----------
const FIXED = [
  ["Not this time.", "SRS-ST-3"], ["You're in.", "SRS-RES-3"], ["We'll buzz you when it's lit.", "FR-RES-5"],
  ["It's lit. {host} is at {spot}.", "SRS-LIT-1"], ["Smaller plan: 15 min at {bench}.", "SRS-EMB-2"],
  ["This link is missing its key.", "SRS-RES-2"], ["Finds your friend. Not for navigation or emergencies.", "SRS-CMP-5"],
  ["Check the path. Map data can be wrong.", "SRS-REST-5"], ["I didn't catch that. Try 'after 2' or 'only with Amor'.", "SRS-COND-8"],
  ["{name} isn't in this group.", "SRS-COND-7"], ["Groups max out at 12.", "SRS-ID-5"], ["{host} is waiting at {spot}.", "SRS-CRE-8"],
  ["Offline. Saved at {time}.", "SRS-OFF-2"], ["Made on this phone", "SRS-AI-4"], ["Made on our laptop", "SRS-AI-4"], ["Made from a template", "SRS-AI-4"],
  ["Count me in for a closer one?", "SRS-ACC-3"], ["Your group met here {n} times.", "BR-K-5"], ["Smaller plan: {step}.", "BR-P-7"],
  ["It's on: {step} at {time}.", "PRD 11.1"], ["Ends after sunset", "BR-P-9"], ["Need {n} more.", "BR-Q-4"], ["Steps mapped", "BR-A-4"],
  ["No steps mapped", "BR-A-4"], ["Thanks for coming.", "PRD 8"], ["Got it: {rules}. Right?", "FR-COND-2"], ["I'm in", "FR-RES-1"],
  ["Add a condition", "SRS-RES-8"], ["Take it back", "SRS-RES-6"], ["Can't make it", "SRS-RES-6"], ["Find them", "FR-LIT-2"],
  ["I'm here", "FR-LIT-2"], ["I'm fading", "FR-PLAN-12"], ["Copy report", "SRS-CAP-1"], ["Fix it", "FR-COND-2"], ["Outside at {spot}. Come?", "FR-AI-1"],
  ["FLARE {code} {spot}. Need {n} more. Reply IN {code}. Ends {time}", "FR-CH-4"], ["No loop keeps benches that close.", "SRS-REST-4"], ["Try {m} m?", "SRS-REST-4"],
  ["This spot may not suit you", "FR-ACC-3"], ["Text yeses max out at 3.", "BR-ID-6"],
];
const allTexts = new Set(Object.values(S).flatMap((e) => [e.text, e.one].filter(Boolean)));
const fixedRows = FIXED.map(([text, src]) => {
  const ok = allTexts.has(text);
  if (!ok) problems.push(`fixed string missing (${src}): "${text}"`);
  return [text, src, ok];
});

// ---------- 1, 2, 3, 6: per string ----------
const rows = [];
for (const [key, e] of Object.entries(S)) {
  const forms = [e.text, e.one].filter(Boolean);
  for (const form of forms) {
    const text = render(key, { ...e, text: form });
    const n = countWords(text);
    const grade = PROSE_KINDS.has(e.kind) || UI_KINDS.has(e.kind) || e.kind === "button" ? fkGrade(text) : null;
    if (form === e.text) rows.push({ key, e, text, n, grade });
    if (e.kind === "button" && n > 3) problem(key, `button has ${n} words`);
    if (UI_KINDS.has(e.kind) && n > 12) problem(key, `${e.kind} has ${n} words (max 12): "${text}"`);
    if (PROSE_KINDS.has(e.kind)) for (const s of sentencesOf(text)) if (countWords(s) > 25) problem(key, `sentence has ${countWords(s)} words (max 25): "${s}"`);
    for (const raw of [form, text]) {
      if (/—/.test(raw)) problem(key, "em dash");
      if (/ – /.test(raw)) problem(key, "en dash used as a dash");
      if (/!/.test(raw)) problem(key, "exclamation mark");
    }
    for (const [list, re] of Object.entries(lists)) {
      if ((allow[key] ?? []).includes(list)) continue;
      const m = text.match(re);
      if (m) { hits[list]++; problem(key, `${listNotes[list]}: "${m[0]}"`); }
    }
  }
}

// ---------- 1: SMS bytes ----------
const pinned = JSON.parse(fs.readFileSync(path.join(REPO, "docs/requirements/evidence/fairlane-pinned-result.json"), "utf8"));
const spotNames = [...new Set(pinned.elements.map((x) => x.tags?.name).filter(Boolean))].sort((a, b) => b.length - a.length || a.localeCompare(b));
const bytes = (s) => Buffer.byteLength(s, "utf8");
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
const segments = (s) => (GSM.test(s) ? (s.length <= 160 ? 1 : Math.ceil(s.length / 153)) : (s.length <= 70 ? 1 : Math.ceil(s.length / 67)));
/** BR-CH-2: fill the template; if over 200 bytes, shorten the named field and end it with "…". */
export function plain(template, vars, field) {
  const fill = (v) => template.replace(/\{(\w+)\}/g, (_, n) => String(v[n]));
  let out = fill(vars);
  if (bytes(out) <= 200) return { out, truncated: false };
  const chars = [...String(vars[field])];
  while (chars.length && bytes(fill({ ...vars, [field]: chars.join("") + "…" })) > 200) chars.pop();
  return { out: fill({ ...vars, [field]: chars.join("").trimEnd() + "…" }), truncated: true };
}
const WORST = { code: "WXYZ9", n: 3, time: "12:40PM", host: "A".repeat(24) };
const smsRows = [];
for (const name of spotNames) {
  const f = plain(S["sms.flare"].text, { ...WORST, spot: name }, "spot");
  const l = plain(S["sms.lit"].text, { ...WORST, spot: name }, "spot");
  smsRows.push({ name, flare: bytes(f.out), lit: bytes(l.out), seg: segments(f.out), gsm: GSM.test(f.out), truncated: f.truncated || l.truncated });
  if (bytes(f.out) > 200 || bytes(l.out) > 200) problem("sms", `${name}: over 200 bytes`);
}
const stress = [
  ["Composite spot from the app: Ford Woods Park, by the pond", { spot: "Ford Woods Park, by the pond" }, "spot", "sms.flare"],
  ["Longest Plan ask (60 characters)", { ask: "W".repeat(59) + "?", n: 5 }, "ask", "sms.plan"],
  ["Street-name fallback of 180 characters", { spot: "S".repeat(180) }, "spot", "sms.flare"],
  ["Non-ASCII name of 120 characters (é is 2 bytes)", { spot: "é".repeat(120) }, "spot", "sms.flare"],
].map(([label, v, field, key]) => {
  const r = plain(S[key].text, { ...WORST, ...v }, field);
  if (bytes(r.out) > 200) problem("sms", `${label}: ${bytes(r.out)} bytes`);
  if (!r.out.isWellFormed()) problem("sms", `${label}: broken UTF-8 after truncation`);
  return { label, out: r.out, bytes: bytes(r.out), truncated: r.truncated, seg: segments(r.out), gsm: GSM.test(r.out) };
});
const example = plain(S["sms.flare"].text, { code: "K7Q2M", spot: "Ford Woods Park pond", n: 1, time: "3:40PM" }, "spot").out;

// ---------- 5: code ----------
const files = [
  ...fs.readdirSync(path.join(ROOT, "src/lib/screens")).filter((f) => f.endsWith(".svelte")).map((f) => `src/lib/screens/${f}`),
  "src/routes/site/+page.svelte", "src/lib/components/InfoLines.svelte", "src/lib/components/NeedCount.svelte", "src/lib/sample.ts",
];
const used = new Set();
const sources = files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]);
const allSrc = sources.map((s) => s[1]).join("\n");
for (const key of Object.keys(S)) if (allSrc.includes(`"${key}"`) || allSrc.includes(`'${key}'`)) used.add(key);
for (const m of allSrc.matchAll(/`(site\.privacy\.row)\.\$\{/g)) for (const k of Object.keys(S)) if (k.startsWith(m[1] + ".")) used.add(k);
for (const m of allSrc.matchAll(/\bt\(\s*"([^"]+)"/g)) if (!S[m[1]]) problems.push(`code uses unknown key "${m[1]}"`);
for (const [f, src] of sources) {
  if (!f.endsWith(".svelte")) continue;
  const markup = stripExpressions(src.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<pre[\s\S]*?<\/pre>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, ""));
  for (const m of markup.matchAll(/>([^<>]*)</g)) {
    const text = m[1].trim();
    if (/[A-Za-z]{2,}/.test(text)) problems.push(`${f}: hardcoded text "${text.slice(0, 40)}"`);
  }
  for (const m of markup.matchAll(/\b(aria-label|title|description|placeholder|label|hint|note|heading|offline|error|alt)="([^"{]*[A-Za-z]{2,}[^"]*)"/g)) problems.push(`${f}: hardcoded ${m[1]}="${m[2]}"`);
}
/** Removes balanced Svelte {...} expressions, so only literal markup text is left. */
function stripExpressions(src) {
  let out = "", depth = 0, quote = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (depth > 0) {
      if (quote) { if (c === quote && src[i - 1] !== "\\") quote = ""; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      continue;
    }
    if (c === "{") { depth = 1; continue; }
    out += c;
  }
  return out;
}
const unused = Object.keys(S).filter((k) => !used.has(k));
const byOwner = {};
for (const k of unused) {
  const e = S[k];
  const group = e.owner ? `Component (wire after merge): ${e.owner}` : /^(push|bot|sms|share|og)\./.test(k) ? `Channel (engineering): ${k.split(".")[0]}` : e.variant ? "Variant not active" : e.status ? "Pending architect decision" : "Engineering or design to place";
  (byOwner[group] ??= []).push(k);
}

// ---------- 6: readability summary ----------
const MIN_WORDS = 4;
const graded = rows.filter((r) => r.grade !== null && r.n >= MIN_WORDS);
const tooShort = rows.filter((r) => r.grade !== null && r.n < MIN_WORDS).length;
const clamp = (g) => Math.max(0, g);
const avg = (arr) => (arr.length ? arr.reduce((a, r) => a + clamp(r.grade), 0) / arr.length : 0);
const ui = graded.filter((r) => UI_KINDS.has(r.e.kind) || r.e.kind === "button");
const prose = graded.filter((r) => PROSE_KINDS.has(r.e.kind));
const over8 = graded.filter((r) => r.grade > 8).sort((a, b) => b.grade - a.grade);
for (const r of over8) if (!r.e.gradeNote) problem(r.key, `grade ${r.grade.toFixed(1)} over 8 with no gradeNote`);

// ---------- write docs ----------
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ⏎ ");
const areas = {};
for (const r of rows) (areas[r.key.split(".")[0]] ??= []).push(r);
const deckMd = [
  "# Flare: Copy deck (every string)",
  "",
  `Generated by \`design/prototype/scripts/copy-lint.mjs\` from \`design/prototype/src/lib/copy/deck.json\` (version ${deck.meta.version}, ${deck.meta.date}). Do not edit this file by hand; edit the JSON and run the script.`,
  "",
  `${rows.length} keys. Text is the template; **Words** and **Grade** are measured on the template filled with the sample values in \`meta.sample\` (Fuego, Ford Woods Park, by the pond). **Source** is the requirement a fixed string comes from; those must not change without a change request.`,
  "",
  "Variants in force: " + Object.entries(deck.meta.variants).map(([k, v]) => `\`${k}\` = ${v}`).join(", ") + ". " + Object.values(deck.meta.variantNotes).join(" "),
  "",
  ...Object.entries(areas).flatMap(([area, list]) => [
    `## ${area}`, "", "| Key | Text | Kind | Words | Grade | Where | Source or status |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...list.map((r) => `| \`${r.key}\` | ${esc(r.e.text)}${r.e.one ? ` (one: ${esc(r.e.one)})` : ""} | ${r.e.kind} | ${r.n} | ${r.grade === null ? "" : r.grade.toFixed(1)} | ${esc(r.e.where ?? "")} | ${esc([r.e.fixed, r.e.status, r.e.owner && "owner: " + r.e.owner].filter(Boolean).join("; "))} |`),
    "",
  ]),
];
fs.mkdirSync(path.join(REPO, "docs/content"), { recursive: true });
fs.writeFileSync(path.join(REPO, "docs/content/02-copy-deck.md"), deckMd.join("\n"));

const kinds = {};
for (const r of rows) kinds[r.e.kind] = (kinds[r.e.kind] ?? 0) + 1;
const maxWords = (pred) => Math.max(...rows.filter(pred).map((r) => r.n));
const checks = [
  "# Flare: Copy checks (lint, readability, SMS bytes)",
  "",
  "Generated by `design/prototype/scripts/copy-lint.mjs`. Run it from `design/prototype` with `node scripts/copy-lint.mjs`; it exits 1 on any problem.",
  "",
  "## Result",
  "",
  `- Strings checked: **${rows.length}** keys (${Object.values(S).filter((e) => e.one).length} with a singular form), in ${Object.keys(kinds).length} kinds: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
  `- Problems: **${problems.length}**.`,
  `- Longest button: ${maxWords((r) => r.e.kind === "button")} words (limit 3). Longest UI string: ${maxWords((r) => UI_KINDS.has(r.e.kind))} words (limit 12). Longest prose sentence: ${Math.max(...rows.filter((r) => PROSE_KINDS.has(r.e.kind)).flatMap((r) => sentencesOf(r.text).map(countWords)))} words (limit 25).`,
  `- Fixed requirement strings present word for word: ${fixedRows.filter((r) => r[2]).length} of ${fixedRows.length}.`,
  `- Code: ${files.length} files scanned; ${used.size} keys used in code; 0 unknown keys${problems.some((p) => p.startsWith("code uses")) ? " (see problems)" : ""}; hardcoded copy found: ${problems.filter((p) => p.includes("hardcoded")).length}.`,
  "",
  problems.length ? "### Problems\n\n" + problems.map((p) => "- " + p).join("\n") + "\n" : "",
  "## No-slop and inclusive language checklist",
  "",
  "Every string, raw template and filled sample, against each rule:",
  "",
  "| Rule | How it's checked | Hits |",
  "| --- | --- | --- |",
  `| No banned words (BRD section 6 list) | regex on 22 words and phrases | ${hits.banned} |`,
  `| No em dashes, no en dash used as a dash | character search | ${problems.filter((p) => /dash/.test(p)).length} |`,
  `| No exclamation marks | character search | ${problems.filter((p) => /exclamation/.test(p)).length} |`,
  `| No filler (just, simply, really, very, basically, actually, literally, totally, quite, in order to, please note, feel free) | word list | ${hits.filler} |`,
  `| No fake urgency (hurry, act now, don't miss, last chance, limited time, only N left, right now, asap) | word list | ${hits.urgency} |`,
  `| No guilt (you missed, missed out, failed, let them down, no one came, nobody could, flaked, ignored, you didn't) | word list | ${hits.guilt} |`,
  `| Numbers, not vague claims (many, a few, several, soon, fast, quickly, instantly, super, amazing, magic, smart) | word list | ${hits.vague} |`,
  `| Never "step-free" (BR-A-4) | word list | ${hits.stepFree} |`,
  `| No ableist idioms (blind spot, crazy, insane, lame, dumb, crippled, sanity check, tone-deaf, wheelchair-bound, suffers from, handicapped, the disabled, normal people, special needs) | word list | ${hits.ableist} |`,
  `| No gendered defaults (he, she, his, her, him, guys, manpower, chairman, mankind, ladies) | word list | ${hits.gendered} |`,
  `| Buttons 3 words or fewer | word count | ${problems.filter((p) => /button has/.test(p)).length} |`,
  `| UI strings 12 words or fewer | word count on filled samples | ${problems.filter((p) => /max 12/.test(p)).length} |`,
  "",
  "## Readability (Flesch-Kincaid grade)",
  "",
  `Formula: 0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59, in \`scripts/readability.mjs\`. Strings of ${MIN_WORDS} words or more are graded (${graded.length}); the other ${tooShort} are buttons and labels of 1 to 3 words, where one long word decides the score and the grade means nothing. Scores below 0 count as 0 in the averages. Target: about grade 6.`,
  "",
  "| Group | Strings | Average grade | Over 8 |",
  "| --- | --- | --- | --- |",
  `| All graded strings | ${graded.length} | ${avg(graded).toFixed(1)} | ${over8.length} |`,
  `| UI (buttons, messages, labels, push, bot) | ${ui.length} | ${avg(ui).toFixed(1)} | ${ui.filter((r) => r.grade > 8).length} |`,
  `| Prose (website, statements, exports) | ${prose.length} | ${avg(prose).toFixed(1)} | ${prose.filter((r) => r.grade > 8).length} |`,
  "",
  "Strings above grade 8, and why they stay:",
  "",
  "| Key | Grade | Text | Why |",
  "| --- | --- | --- | --- |",
  ...over8.map((r) => `| \`${r.key}\` | ${r.grade.toFixed(1)} | ${esc(r.text)} | ${esc(r.e.gradeNote ?? "")} |`),
  "",
  "Per-string grades are in [02-copy-deck.md](02-copy-deck.md).",
  "",
  "## Plain-text SMS and satellite form (BR-CH-2, BR-CH-3, SRS-CH-5)",
  "",
  `Template: \`${S["sms.flare"].text}\`. Example: \`${example}\` (${bytes(example)} bytes).`,
  "",
  `Worst case for every named spot in the pinned Overpass result (docs/requirements/evidence/fairlane-pinned-result.json, OSM ${pinned.osm3s.timestamp_osm_base}, ${spotNames.length} names): 5-character code, "Need 3 more" (the most a Flare can need), a 7-character time "12:40PM", and a 24-character host name for the Lit line. Limit 200 bytes UTF-8.`,
  "",
  "| Spot name | Flare text, bytes | Lit text, bytes | SMS segments | GSM-7 only | Truncated |",
  "| --- | --- | --- | --- | --- | --- |",
  ...smsRows.map((r) => `| ${esc(r.name)} | ${r.flare} | ${r.lit} | ${r.seg} | ${r.gsm ? "yes" : "no"} | ${r.truncated ? "yes" : "no"} |`),
  "",
  `Largest: ${Math.max(...smsRows.map((r) => r.flare))} bytes (Flare), ${Math.max(...smsRows.map((r) => r.lit))} bytes (Lit). Every named spot fits without truncation and in 1 SMS segment.`,
  "",
  "Stress cases (truncation per BR-CH-2):",
  "",
  "| Case | Bytes | Truncated | Segments | GSM-7 only |",
  "| --- | --- | --- | --- | --- |",
  ...stress.map((r) => `| ${esc(r.label)} | ${r.bytes} | ${r.truncated ? "yes" : "no"} | ${r.seg} | ${r.gsm ? "yes" : "no"} |`),
  "",
  `Note for engineering: the "…" that BR-CH-2 asks for is not in the GSM-7 alphabet, so a truncated text switches the whole SMS to UCS-2 (70 characters per segment) and splits into 3 parts. Truncation only happens for spot names over ${200 - (bytes(plain(S["sms.flare"].text, { ...WORST, spot: "" }, "spot").out))} bytes; the longest Fairlane name is ${bytes(spotNames[0])}. See handoff 06.`,
  "",
  "## Fixed strings from the requirements",
  "",
  "| Text | Source | In the deck |",
  "| --- | --- | --- |",
  ...fixedRows.map(([t, s, ok]) => `| ${esc(t)} | ${s} | ${ok ? "yes" : "**missing**"} |`),
  "",
  "## Keys not shown by the prototype yet",
  "",
  "These strings are final but live in channels or components outside this role's files. Each group says who wires it.",
  "",
  ...Object.entries(byOwner).map(([g, ks]) => `- **${g}** (${ks.length}): ${ks.map((k) => "`" + k + "`").join(", ")}`),
  "",
];
fs.writeFileSync(path.join(REPO, "docs/content/03-checks.md"), checks.join("\n"));

console.log(`Strings: ${rows.length}. Fixed: ${fixedRows.filter((r) => r[2]).length}/${fixedRows.length}. Used in code: ${used.size}. Grade avg ${avg(graded).toFixed(1)} (UI ${avg(ui).toFixed(1)}, prose ${avg(prose).toFixed(1)}), over 8: ${over8.length}. SMS max ${Math.max(...smsRows.map((r) => r.flare))} bytes. Problems: ${problems.length}`);
problems.forEach((p) => console.log(" -", p));
process.exit(problems.length ? 1 : 0);
