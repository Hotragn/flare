import fs from "node:fs";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { contractProblems, toOpenApiPath } from "../lib/contracts.ts";

const dir = new URL("../../docs/architecture/contracts/", import.meta.url);
const openapi = YAML.parse(fs.readFileSync(new URL("openapi.yaml", dir), "utf8"));
const asyncapi = YAML.parse(fs.readFileSync(new URL("asyncapi.yaml", dir), "utf8"));

describe("contract drift checks", () => {
  it("maps Hono params to OpenAPI params", () => {
    expect(toOpenApiPath("/api/v1/gatherings/:gatheringId/me")).toBe("/api/v1/gatherings/{gatheringId}/me");
  });
  it("passes on the real contracts", async () => {
    expect(await contractProblems(openapi, asyncapi)).toEqual([]);
  });
  it("catches a server route missing from openapi.yaml", async () => {
    const cut = structuredClone(openapi);
    delete cut.paths["/api/v1/drafts"];
    expect(await contractProblems(cut, asyncapi)).toContain("route POST /api/v1/drafts is not in openapi.yaml");
  });
  it("catches a hub error code missing from asyncapi.yaml", async () => {
    const cut = structuredClone(asyncapi);
    cut.components.messages.result.payload.properties.error.enum = ["timeout"];
    const problems = await contractProblems(openapi, cut);
    expect(problems).toContain('hub error "bad_image" in code is not in asyncapi.yaml');
  });
});
