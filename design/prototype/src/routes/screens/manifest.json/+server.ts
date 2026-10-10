import { json } from "@sveltejs/kit";
import { screens } from "#lib/screens/registry.ts";
export const prerender = true;
export const GET = () => json(screens.map(({ id, name, states, themes }) => ({ id, name, states, themes })));
