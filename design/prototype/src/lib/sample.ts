// Sample content for the design prototype. Names are our four testers' first
// names (allowed by the founder). Places are real OpenStreetMap features near
// Fairlane Town Center; distances are illustrative until the field test.
import type { Step } from "./components/parts";
import { t } from "./copy/index.ts";

export const people = { host: "Fuego", friends: ["Amor", "Shilp", "Ammo"] };

export const flare = {
  words: "Golden pond, come sit with me",
  scene: "A pond with yellow trees and an empty bench.",
  spot: "Ford Woods Park, by the pond",
  spotShort: "the pond",
  hostLine: t("send.hostLine", { host: "Fuego", spot: "the bench by the pond" }),
  walk: t("invite.walk", { min: 9 }),
  walkMin: 9,
  emberBench: "the bench by the lot",
  emberBenchCap: "The bench by the lot",
  emberMeters: 80,
  emberFrom: "the pond",
  sunset: "Sunset 6:57 PM",
  sunsetTime: "6:57 PM",
  shrinkMin: 18,
  sentMin: 2,
  coming: 3,
  here: 3,
  savedAt: "2:14 PM",
  code: "K7Q2M",
};

export const plan = {
  ask: "Fairlane walk at 11?",
  start: "11:00 AM",
  deadline: "10:40 AM",
  startLabel: "Sun 11:00 AM",
  deadlineLabel: "Sun 10:40 AM",
  deadlineBadLabel: "Sun 10:55 AM",
  steps: [
    { name: "Ford Woods loop", place: "Ford Woods Park", minutes: 60, access: "Benches every 300 m" },
    { name: "Park loop", place: "Ford Woods Park", minutes: 30, access: "Benches every 150 m" },
    { name: "Short walk", place: "Pond path", minutes: 15, access: "Flat, no steps mapped" },
    { name: "20 min on the bench", place: "Bench by the pond", minutes: 20, access: "Restroom 180 m" },
  ] satisfies Step[],
};

export const loop = {
  ask: "Knee's bad, 40 minutes, want trees",
  readback: "40 min, seats every 200 m, trees, no steps.",
  nextLimit: 300,
  benches: 4,
  turns: [
    t("loop.turn.start", { place: "the bench by the pond" }),
    t("loop.turn.left", { path: "the pond path", m: 150 }),
    t("loop.turn.right", { landmark: "the big oak", m: 180 }),
    t("loop.turn.restroom", { side: "left" }),
    t("loop.turn.straight", { landmark: "the playground", m: 170 }),
    t("loop.turn.end", { place: "the bench by the pond" }),
  ],
  totalMeters: 1950,
  minutes: 39,
};

// Phone tier download (O8): sample size from product design; the real size comes from the model file the lab picks.
export const phoneModel = { mb: 290, pct: 38 };

export const sparks = [
  { place: "Ford Woods Park, by the pond", times: 2, line: "Geese took our bench. We let them." },
  { place: "Rouge River path", times: 1, line: "" },
];
