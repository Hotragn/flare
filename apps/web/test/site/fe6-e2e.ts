// FE6 end to end on the built app with PWA's real store and crypto: Hot spots opens a sealed
// blob and its newest Spark, the needs profile saves on the phone with 0 requests, and Forget
// deletes on the server first, then on the phone. axe runs on each filled state (FE7).
//   npm run build && node apps/web/test/site/fe6-e2e.ts     (port 8884, installed Chrome)
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright-core";
import { flareCrypto as c } from "../../src/lib/crypto/index.ts";
import { serve } from "./serve.ts";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");

const G = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const SPARK = "44444444-4444-4444-8444-444444444444";
const TOKEN = "dGVzdC13cml0ZS10b2tlbg";

const { key, fragment } = await c.newGroupKey();
const blob_ct = await c.sealJson(key, `h:${G}`, {
  v: 1,
  places: [
    { place_key: "osm:node/1", place_name: "Bench by the pond", count: 4, last_date: "2026-10-04", spark_id: SPARK },
    { place_key: "osm:node/2", place_name: "Maple picnic table", count: 2, last_date: "2026-10-09", spark_id: null },
  ],
});
const sparkHash = await c.placeHash(key, "osm:node/1");
const text_ct = await c.seal(key, `s:${G}:${SPARK}`, new TextEncoder().encode("Ducks came right up"));

type Req = { path: string; method: string; auth: string | undefined };
const reqs: Req[] = [];
const site = await serve(8884, (p, method, headers) => {
  reqs.push({ path: p, method, auth: headers.authorization });
  if (headers.authorization !== `Bearer ${M}.${TOKEN}`) return { status: 401, body: { code: "unauthorized" } };
  if (p === `/api/v1/groups/${G}/hotspots`) return { status: 200, body: { blob_ct, version: 2 } };
  if (p === `/api/v1/groups/${G}/sparks?place=${encodeURIComponent(sparkHash)}&limit=1`)
    return { status: 200, body: { sparks: [{ id: SPARK, text_ct, created_on: "2026-10-04" }] } };
  if (p === `/api/v1/groups/${G}/members/${M}` && method === "DELETE")
    return { status: 200, body: { last_member: false, sparks_deleted: 0 } };
  return null;
});

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.info(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
};
async function axe(page: Page, what: string) {
  await page.addScriptTag({ path: AXE });
  const v = (await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axe is injected at run time
    const r = await (window as any).axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((x: { id: string; impact: string }) => `${x.impact} ${x.id}`);
  })) as string[];
  const bad = v.filter((x) => /^(serious|critical)/.test(x));
  check(bad.length === 0, `axe on ${what}: ${v.length} findings, ${bad.length} serious or critical ${bad.join(", ")}`);
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Needs: opening the page creates the store; saving makes no request (SRS-ACC-1).
  await page.goto(`${site.url}/app/needs/`, { waitUntil: "networkidle" });
  await page.getByText("Nothing set").waitFor();
  const before = reqs.length;
  await page.getByRole("radio", { name: "Yes" }).first().click();
  await page.getByRole("radio", { name: "200 m" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved on this phone.").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  const pressed = await page.getByRole("radio", { name: "200 m" }).getAttribute("aria-checked");
  check(pressed === "true", "needs survive a reload");
  check(reqs.length === before, `needs made ${reqs.length - before} server requests`);
  await axe(page, "/app/needs/ filled");

  // Seed the group the way the store keeps it: a non-extractable AES key plus its fragment.
  await page.evaluate(
    async ({ G, M, TOKEN, fragment }) => {
      const raw = Uint8Array.from(atob(fragment.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
      const k = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      await new Promise<void>((ok, fail) => {
        const open = indexedDB.open("flare");
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("groups", "readwrite");
          tx.objectStore("groups").put({
            groupId: G,
            key: k,
            memberId: M,
            token: TOKEN,
            names: { [M]: "Amor", b: "Bea" },
            fragment,
          });
          tx.oncomplete = () => ok();
          tx.onerror = () => fail(tx.error);
        };
      });
    },
    { G, M, TOKEN, fragment },
  );

  // Hot spots: opened on the phone, ordered by count (SRS-HOT-1), newest Spark shown (BR-K-5).
  await page.goto(`${site.url}/app/hotspots/?g=${G}`, { waitUntil: "networkidle" });
  await page.getByText("Bench by the pond").waitFor();
  const names = await page.locator("li.spot b").allTextContents();
  check(names.join("|") === "Bench by the pond|Maple picnic table", `hot spots order: ${names.join(", ")}`);
  check(await page.getByText("Met here 4 times").isVisible(), "count line");
  await page.getByText("Ducks came right up").waitFor({ timeout: 5000 });
  check(true, "newest Spark opened with s:{group}:{spark}");
  check(!reqs.some((r) => r.path.includes("osm")), "place keys never sent, only hashes");
  await axe(page, "/app/hotspots/ list");

  // Forget: server first, then the phone (SRS-ID-6).
  await page.goto(`${site.url}/app/forget/?g=${G}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Forget it" }).waitFor();
  await axe(page, "/app/forget/ ask");
  await page.getByRole("button", { name: "Forget it" }).click();
  await page.getByText("Done. This phone has nothing from that group.").waitFor();
  check(
    reqs.some((r) => r.method === "DELETE" && r.path === `/api/v1/groups/${G}/members/${M}`),
    "DELETE member sent with the bearer",
  );
  const left = await page.evaluate(
    (G) =>
      new Promise<boolean>((ok) => {
        const open = indexedDB.open("flare");
        open.onsuccess = () => {
          const get = open.result.transaction("groups").objectStore("groups").get(G);
          get.onsuccess = () => ok(get.result !== undefined);
        };
      }),
    G,
  );
  check(!left, "group gone from this phone");
  await page.goto(`${site.url}/app/hotspots/?g=${G}`, { waitUntil: "networkidle" });
  await page.getByText("Open your group's link on this phone first.").waitFor();
  check(true, "hot spots after forget shows the no-group line");
  check(errors.length === 0, `page errors: ${errors.length} ${errors.join("; ")}`);
} finally {
  await browser.close();
  await site.close();
}
console.info(failures ? `${failures} checks failed` : "FE6 end to end: all checks pass");
process.exit(failures ? 1 : 0);
