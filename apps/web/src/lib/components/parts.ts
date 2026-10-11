// Small shared helpers for screens.
export type Theme = "light" | "dark" | "sun";
export const themeAttrs = (t: Theme) => (t === "sun" ? { "data-sun": "" } : { "data-theme": t });
export type Step = { name: string; place: string; minutes: number; access: string; afterSunset?: boolean };
