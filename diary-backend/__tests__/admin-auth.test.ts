import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { isAdminAuthConfigured, verifyAdminCredentials } from "../lib/admin-auth";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_USERNAME = "root";
  process.env.ADMIN_PASSWORD = "secret-pass";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("isAdminAuthConfigured", () => {
  it("is true only when both username and password are set", () => {
    expect(isAdminAuthConfigured()).toBe(true);
    delete process.env.ADMIN_PASSWORD;
    expect(isAdminAuthConfigured()).toBe(false);
  });
});

describe("verifyAdminCredentials", () => {
  it("returns the username for correct credentials", () => {
    expect(verifyAdminCredentials({ username: "root", password: "secret-pass" })).toEqual({
      username: "root",
    });
  });
  it("rejects wrong username or password", () => {
    expect(verifyAdminCredentials({ username: "root", password: "x" })).toBeNull();
    expect(verifyAdminCredentials({ username: "nope", password: "secret-pass" })).toBeNull();
  });
  it("rejects when not configured", () => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    expect(verifyAdminCredentials({ username: "root", password: "secret-pass" })).toBeNull();
  });
});
