// Render free tier cold start (ADR-0005 amended): a request slower than 4 s raises the
// "Waking up the server" banner until it finishes; fast requests never show it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { net, timed } from "../../src/lib/net/waking.svelte.ts";

afterEach(() => vi.useRealTimers());

describe("waking banner", () => {
  it("shows only while a request is slower than 4 s, and clears when it ends", async () => {
    vi.useFakeTimers();
    let done!: (v: string) => void;
    const slow = timed(new Promise<string>((r) => (done = r)));
    await vi.advanceTimersByTimeAsync(3900);
    expect(net.slow).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(net.slow).toBe(1);
    done("ok");
    expect(await slow).toBe("ok");
    expect(net.slow).toBe(0);
    await timed(Promise.resolve(1));
    await vi.advanceTimersByTimeAsync(5000);
    expect(net.slow).toBe(0);
  });
  it("clears after a failed slow request too", async () => {
    vi.useFakeTimers();
    let fail!: (e: Error) => void;
    const p = timed(new Promise((_, j) => (fail = j)));
    await vi.advanceTimersByTimeAsync(4100);
    expect(net.slow).toBe(1);
    fail(new Error("network"));
    await expect(p).rejects.toThrow("network");
    expect(net.slow).toBe(0);
  });
});
