// Every screen, its states and the themes it is designed for. Drives the screen
// catalog, the PNG exports and the wireframes. Ids match docs/design/02-flows-and-ia.md.
import type { Component } from "svelte";
import type { Theme } from "../components/parts";

type Entry = { id: string; name: string; states: string[]; themes: Theme[]; load: () => Promise<{ default: Component<any> }> };

const LD: Theme[] = ["light", "dark"];
const SUN: Theme[] = ["sun", "dark"];

export const screens: Entry[] = [
  { id: "H1", name: "Camera", states: ["live", "permission", "denied", "loading"], themes: LD, load: () => import("./H1Camera.svelte") },
  { id: "H2", name: "Develop", states: ["developing", "drafted", "hub-unreachable", "offline"], themes: LD, load: () => import("./H2Develop.svelte") },
  { id: "H3", name: "Send it", states: ["ready", "editing", "sending", "error", "offline"], themes: LD, load: () => import("./H3Send.svelte") },
  { id: "H4", name: "Sent", states: ["success"], themes: LD, load: () => import("./H4Sent.svelte") },
  { id: "H5", name: "Host: Kindling", states: ["zero", "growing", "near", "offline"], themes: SUN, load: () => import("./H5HostKindling.svelte") },
  { id: "H6", name: "Host: Lit", states: ["lit", "arrivals", "plusone", "done"], themes: SUN, load: () => import("./H6HostLit.svelte") },
  { id: "I0", name: "Join group", states: ["empty", "typing", "error"], themes: LD, load: () => import("./I0Join.svelte") },
  { id: "I1", name: "Invite", states: ["kindling", "loading", "missing-key", "lit", "gone"], themes: ["light", "dark", "sun"], load: () => import("./I1Invite.svelte") },
  { id: "I2", name: "Add a condition", states: ["empty", "typing", "dictating", "didnt-catch", "not-in-group"], themes: LD, load: () => import("./I2Condition.svelte") },
  { id: "I3", name: "Read-back", states: ["flare", "plan"], themes: LD, load: () => import("./I3Readback.svelte") },
  { id: "I4", name: "You're in", states: ["success", "queued"], themes: LD, load: () => import("./I4YoureIn.svelte") },
  { id: "I5", name: "Spot may not suit you", states: ["prompt"], themes: LD, load: () => import("./I5NotSuit.svelte") },
  { id: "I6", name: "Lit", states: ["lit", "offline", "smaller"], themes: SUN, load: () => import("./I6Lit.svelte") },
  { id: "I7", name: "Find them", states: ["pointing", "facing", "no-orientation", "no-gps", "offline"], themes: SUN, load: () => import("./I7Compass.svelte") },
  { id: "I8", name: "I'm here", states: ["success"], themes: SUN, load: () => import("./I8Here.svelte") },
  { id: "I9", name: "Ember", states: ["waiting", "lit"], themes: SUN, load: () => import("./I9Ember.svelte") },
  { id: "I10", name: "Not this time", states: ["gone"], themes: LD, load: () => import("./I10Gone.svelte") },
  { id: "I11", name: "Spark", states: ["empty", "typing", "saved"], themes: LD, load: () => import("./I11Spark.svelte") },
  { id: "I12", name: "Go outside", states: ["end"], themes: LD, load: () => import("./I12Outside.svelte") },
];

export const byId = (id: string) => screens.find((s) => s.id === id);
