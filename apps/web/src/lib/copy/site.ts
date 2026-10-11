// The copy deck for website pages: the app's deck plus the website's own lines (site.*, og.*),
// which vite.config.ts keeps out of the app bundle. Website pages import t from here.
import site from "../../../../../design/prototype/src/lib/copy/deck.json?site";
import { addStrings } from "./index.ts";

addStrings((site as { strings: Parameters<typeof addStrings>[0] }).strings);

export * from "./index.ts";
