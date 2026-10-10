import { screens } from "#lib/screens/registry.ts";
export const prerender = true;
export const ssr = false;
export const entries = () => screens.map((s) => ({ id: s.id }));
export const load = ({ params }) => ({ id: params.id });
