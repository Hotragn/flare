import { describe, expect, it } from "vitest";
import { check } from "../lib/env-spec.ts";
import { accountToken } from "../lib/token-guard.ts";

// Built at run time so the secret scan never matches this file.
const pat = ["dop", "v1", "a".repeat(64)].join("_");
const sentryUser = ["sntryu", "b".repeat(64)].join("_");

describe("account tokens in narrow slots", () => {
  it("names the token kind without echoing it", () => {
    expect(accountToken(pat)).toContain("DigitalOcean personal access token");
    expect(accountToken(sentryUser)).toContain("Sentry user auth token");
    expect(accountToken("https://abc@o1.ingest.sentry.io/2")).toBeNull();
  });
  it("check-env fails both slots with a reason and no value", () => {
    const lines = check({ DO_MODEL_ACCESS_KEY: pat, SENTRY_DSN: sentryUser }, ["server"]);
    const bad = lines.filter((l) => l.status === "invalid").map((l) => l.key);
    expect(bad).toEqual(expect.arrayContaining(["DO_MODEL_ACCESS_KEY", "SENTRY_DSN"]));
    expect(JSON.stringify(lines)).not.toContain(pat);
    expect(JSON.stringify(lines)).not.toContain(sentryUser);
  });
});
