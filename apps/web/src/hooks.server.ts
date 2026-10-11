// Runs at prerender time only (adapter-static). The website pages (and /ai/) are prerendered
// HTML that hydrates for the flame motion and the live audit, so their scripts need not
// compete with the text for the first paint (Lighthouse 100 on mobile, docs/website):
// - no modulepreload links there;
// - the inline boot script imports SvelteKit's start module after the first frame, not during
//   parsing. The page is already painted from the prerendered HTML; hydration follows a frame
//   later, so the motion is unchanged. The server hashes the final inline script for the CSP
//   (apps/server/src/app.ts inlineScriptHashes), so the edited script stays allowed.
// App pages keep SvelteKit's defaults.
import type { Handle } from "@sveltejs/kit/hooks";

const SITE = /^\/(\(site\)|ai)(\/|$)/;
const BOOT = /import\(("[^"]*\/entry\/start\.[^"]+\.js")\)\.then\(/;
const AFTER_FIRST_FRAME = "new Promise((r) => requestAnimationFrame(() => setTimeout(r))).then(() => import($1)).then(";

export const handle: Handle = ({ event, resolve }) => {
  if (!SITE.test(event.route.id ?? "")) return resolve(event);
  return resolve(event, {
    preload: ({ type }) => type === "css",
    transformPageChunk: ({ html }) => html.replace(BOOT, AFTER_FIRST_FRAME),
  });
};
