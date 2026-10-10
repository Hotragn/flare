// Sample content for the design prototype. Names are our four testers' first
// names (allowed by the founder). Places are real OpenStreetMap features near
// Fairlane Town Center; distances are illustrative until the field test.
import type { Step } from "./components/parts";

export const people = { host: "Fuego", friends: ["Amor", "Shilp", "Ammo"] };

export const flare = {
  words: "Golden pond, come sit with me",
  scene: "A pond with yellow trees and an empty bench.",
  spot: "Ford Woods Park, by the pond",
  spotShort: "the pond",
  hostLine: "Fuego is waiting at the bench by the pond.",
  walk: "9 min walk",
  emberBench: "the bench by the lot",
  emberDistance: "80 m from the pond",
  sunset: "Sunset 6:57 PM",
  code: "K7Q2M",
};

export const plan = {
  ask: "Fairlane walk at 11?",
  start: "11:00 AM",
  deadline: "10:40 AM",
  steps: [
    { name: "Ford Woods loop", place: "Ford Woods Park", minutes: 60, access: "Benches every 300 m" },
    { name: "Park loop", place: "Ford Woods Park", minutes: 30, access: "Benches every 150 m" },
    { name: "Short walk", place: "Pond path", minutes: 15, access: "Flat, no steps mapped" },
    { name: "20 min on the bench", place: "Bench by the pond", minutes: 20, access: "Restroom 180 m" },
  ] satisfies Step[],
};

export const loop = {
  ask: "Knee's bad, 40 minutes, want trees",
  readback: "40 min, a seat every 200 m, trees, no steps.",
  turns: [
    "Start at the bench by the pond.",
    "Left on the pond path. Bench in 150 m.",
    "Right at the big oak. Bench in 180 m, under trees.",
    "Straight past the playground. Restroom on your left.",
    "Left back to the pond. Bench in 170 m.",
  ],
  totalMeters: 1950,
  minutes: 39,
};

export const sparks = [
  { place: "Ford Woods Park, by the pond", times: 2, line: "Geese took our bench. We let them." },
  { place: "Rouge River path", times: 1, line: "" },
];
