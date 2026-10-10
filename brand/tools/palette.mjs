// Flare color system. Single source for tokens, contrast checks and asset builds.
export const colors = {
  "birch-50": "#FBF8F2",
  "birch-100": "#F6F1E7",
  "birch-200": "#E8DFCE",
  "ink-900": "#211A16",
  "ink-700": "#4A3F38",
  "maple-500": "#E2622A",
  "maple-600": "#D9531E",
  "maple-700": "#A93C12",
  "ember-700": "#9E2C17",
  "gold-400": "#F2B33D",
  "gold-300": "#F7CB72",
  "pine-700": "#1F4D3A",
  "pine-500": "#2F6B52",
  "dusk-900": "#16233A",
  "dusk-800": "#1B2A41",
  "dusk-700": "#2E4A6B",
  "dusk-300": "#A9BCD2",
  "smoke-500": "#6F7987",
  "smoke-300": "#B7BDC5",
};

// Roles used by product design. Each text pair is checked in contrast.mjs.
// State is carried by shape (flame size, dome, smoke), never by color alone,
// so Kindling and Lit share maple in light mode.
export const roles = {
  light: {
    bg: "birch-100", surface: "birch-50", line: "birch-200",
    text: "ink-900", textMuted: "ink-700",
    accentBg: "maple-700", accentText: "maple-700", onAccent: "birch-50",
    lit: "maple-600", kindling: "maple-600", ember: "ember-700", gone: "smoke-500",
    positive: "pine-700",
  },
  dark: {
    bg: "dusk-900", surface: "dusk-800", line: "dusk-700",
    text: "birch-100", textMuted: "dusk-300",
    accentBg: "maple-500", accentText: "gold-300", onAccent: "ink-900",
    lit: "maple-500", kindling: "gold-400", ember: "maple-600", gone: "smoke-300",
    positive: "gold-300",
  },
};
