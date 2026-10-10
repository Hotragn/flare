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
];

export const byId = (id: string) => screens.find((s) => s.id === id);
