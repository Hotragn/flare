// Small shared helpers for screens.
export type Theme = "light" | "dark" | "sun";
export const themeAttrs = (t: Theme) => (t === "sun" ? { "data-sun": "" } : { "data-theme": t });
export type Step = { name: string; place: string; minutes: number; access: string; afterSunset?: boolean };
/** Access line counts within 200 m (openapi SealedGathering.access, ICD-6 AccessLine). */
export type Amenity = { count: number; nearest_m: number | null };
export type Access = { benches: Amenity; restrooms: Amenity; water: Amenity; steps_mapped: boolean };

/** What the invitee screens show, opened from the sealed gathering on this phone. */
export type InviteInfo = {
  host: string;
  words: string; // the six-word invite, or the Plan's ask
  scene: string; // photo alt text (SRS-ACC-5)
  photo: string; // object URL of the opened photo, "" while it loads or when there is none
  spot: string;
  hostLine: string;
  walkMin: number | null; // only with location allowed (SRS-RES-1)
  access: Access | null;
  nature: string;
  met?: { times: number; line: string } | null; // Sparks history line (SRS-SPK-2)
};
