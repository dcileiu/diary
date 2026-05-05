import { NextResponse } from "next/server";

export type MpBody<T> = { code: number; data: T; msg?: string };

export function mpOk<T>(data: T, init?: ResponseInit) {
  const body: MpBody<T> = { code: 0, data };
  return NextResponse.json(body, init);
}

function httpStatusForCode(code: number): number {
  if (Number.isFinite(code) && code >= 400 && code <= 599) return code;
  return 400;
}

export function mpErr(code: number, msg: string, init?: ResponseInit) {
  return NextResponse.json(
    { code, data: null, msg },
    { status: httpStatusForCode(code), ...init },
  );
}

export function mpUnauthorized() {
  return NextResponse.json(
    { code: 401, data: null, msg: "未授权" },
    { status: 401 },
  );
}

/** 服务端异常：保留 body.code 供小程序使用，同时回正 HTTP 500 便于监控与网关识别 */
export function mpServerError(msg: string) {
  return NextResponse.json(
    { code: 500, data: null, msg },
    { status: 500 },
  );
}

export function mpErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
