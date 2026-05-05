import { NextResponse } from "next/server";

const NO_STORE = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

/** 管理端列表/实时数据：禁止 CDN 与浏览器缓存，避免删改后列表仍显示旧数据 */
export function adminJson(data: unknown, init?: ResponseInit) {
  const h = new Headers(init?.headers);
  for (const [k, v] of Object.entries(NO_STORE)) {
    if (!h.has(k)) h.set(k, v);
  }
  return NextResponse.json(data, { ...init, headers: h });
}
