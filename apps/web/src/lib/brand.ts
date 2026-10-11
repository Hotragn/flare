// Brand geometry shared with brand/tools/shared.mjs (keep in sync: FLAME, HOLE, DOME).
export const FLAME =
  "M55 4 C61 20 80 34 80 60 C80 81 66 96 50 96 C34 96 20 81 20 60 C20 45 29 35 37 27 C37 37 41 43 46 45 C43 31 48 16 55 4 Z";
export const HOLE = { cx: 50, cy: 67, r: 12 };
export const DOME = "M17 86 C17 68 32 60 50 60 C68 60 83 68 83 86 C83 92 74 95 50 95 C26 95 17 92 17 86 Z";
export const ring = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

export type FlameState = "kindling" | "lit" | "ember" | "gone";

// Inline the brand UI icons (24 grid, 2 px stroke, currentColor).
const raw = import.meta.glob("./generated/icons/*.svg", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
export const icons: Record<string, string> = Object.fromEntries(
  Object.entries(raw).map(([p, svg]) => [p.split("/").pop()!.replace(".svg", ""), svg]),
);
export type IconName = keyof typeof icons;
