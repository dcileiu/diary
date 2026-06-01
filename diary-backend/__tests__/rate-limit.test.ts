import { describe, expect, it } from "vite-plus/test";

import { checkRateLimit, clientIpFromRequest } from "../lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses independent counters per key", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const key = `win:${Math.random()}`;
    expect(checkRateLimit(key, 1, 10).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 10).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(checkRateLimit(key, 1, 10).allowed).toBe(true);
  });
});

describe("clientIpFromRequest", () => {
  it("prefers the leftmost x-forwarded-for entry", () => {
    const req = new Request("http://x/y", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });
    expect(clientIpFromRequest(req)).toBe("1.1.1.1");
  });
  it("falls back to x-real-ip then unknown", () => {
    const req = new Request("http://x/y", {
      headers: { "x-real-ip": "3.3.3.3" },
    });
    expect(clientIpFromRequest(req)).toBe("3.3.3.3");
    expect(clientIpFromRequest(new Request("http://x/y"))).toBe("unknown");
  });
});
