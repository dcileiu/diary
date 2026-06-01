import { describe, expect, it } from "vite-plus/test";

import {
  asText,
  clampInt,
  clampLevel,
  normalizeIdList,
  parseDateInput,
  parsePagination,
  positiveInt,
} from "../lib/validation";

describe("asText", () => {
  it("trims and stringifies", () => {
    expect(asText("  hi ")).toBe("hi");
    expect(asText(123)).toBe("123");
  });
  it("treats null/undefined as empty", () => {
    expect(asText(null)).toBe("");
    expect(asText(undefined)).toBe("");
  });
});

describe("positiveInt", () => {
  it("accepts positive integers", () => {
    expect(positiveInt(5)).toBe(5);
    expect(positiveInt("7")).toBe(7);
  });
  it("rejects zero, negatives, non-integers and garbage", () => {
    expect(positiveInt(0)).toBeNull();
    expect(positiveInt(-3)).toBeNull();
    expect(positiveInt(1.5)).toBeNull();
    expect(positiveInt("abc")).toBeNull();
    expect(positiveInt(null)).toBeNull();
  });
});

describe("clampLevel", () => {
  it("clamps into [1,5]", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(9)).toBe(5);
    expect(clampLevel(3)).toBe(3);
  });
  it("falls back on garbage", () => {
    expect(clampLevel("x")).toBe(3);
    expect(clampLevel("x", 2)).toBe(2);
  });
});

describe("clampInt", () => {
  it("clamps and rounds", () => {
    expect(clampInt(2.6, -2, 2, 0)).toBe(2);
    expect(clampInt(-9, -2, 2, 0)).toBe(-2);
    expect(clampInt("nope", -2, 2, 0)).toBe(0);
  });
});

describe("parseDateInput", () => {
  it("parses valid dates and rejects invalid", () => {
    expect(parseDateInput("2026-01-02T00:00:00Z")?.getUTCFullYear()).toBe(2026);
    expect(parseDateInput("not-a-date")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });
});

describe("normalizeIdList", () => {
  it("dedupes and keeps positive ints from arrays and csv", () => {
    expect(normalizeIdList([1, 2, 2, "3", 0, -1])).toEqual([1, 2, 3]);
    expect(normalizeIdList("4,5,5,x")).toEqual([4, 5]);
    expect(normalizeIdList(null)).toEqual([]);
  });
});

describe("parsePagination", () => {
  it("applies defaults and caps page size", () => {
    expect(parsePagination(undefined, undefined)).toEqual({
      page: 1,
      pageSize: 10,
      skip: 0,
      take: 10,
    });
    expect(
      parsePagination("3", "999", { defaultPageSize: 10, maxPageSize: 30 }),
    ).toEqual({ page: 3, pageSize: 30, skip: 60, take: 30 });
  });
  it("coerces invalid input to safe values", () => {
    expect(parsePagination("-5", "abc")).toMatchObject({ page: 1, pageSize: 10 });
  });
});
