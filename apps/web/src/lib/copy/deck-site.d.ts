// #lib/copy/site.ts imports the website's lines of the copy deck (vite.config.ts, slimDeck).
// A script file (no import or export), so the wildcard module declaration is global.
declare module "*deck.json?site" {
  const deck: { strings: Record<string, { text: string; one?: string; kind: string }> };
  export default deck;
}
