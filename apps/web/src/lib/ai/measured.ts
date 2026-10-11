// "Measured, not shipped" (CR-E2): in-browser models the lab ran and why none ships on phones.
// Numbers from lab reports 01, 07 and 09 (Apple M4, Chrome 154 and Safari 26.6.2, 2026-10-10).
// docs/ai-runtime/measured-not-shipped.md has the full table and the sources.

export type Reason = "buffer" | "quality" | "noBetter" | "kernel";
export type Measured = { model: string; task: "photo" | "conditions"; mb: number; reason: Reason; report: string };

export const MEASURED: Measured[] = [
  { model: "Gemma 4 E2B", task: "photo", mb: 3380, reason: "buffer", report: "01" },
  { model: "SmolVLM-500M", task: "photo", mb: 363, reason: "quality", report: "09" },
  { model: "Qwen3-0.6B", task: "conditions", mb: 570, reason: "noBetter", report: "07" },
  { model: "Qwen3.5-0.8B", task: "conditions", mb: 470, reason: "noBetter", report: "07" },
  { model: "LFM2.5-350M", task: "conditions", mb: 255, reason: "noBetter", report: "07" },
  { model: "Gemma 3 270M", task: "conditions", mb: 273, reason: "noBetter", report: "07" },
  { model: "SmolLM2-360M", task: "conditions", mb: 272, reason: "noBetter", report: "07" },
  { model: "Granite 4.0 H 350M", task: "conditions", mb: 238, reason: "kernel", report: "07" },
];
