import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

export function ensureAdmin(req: Request) {
  if (isAdminRequest(req.headers.get("authorization"))) {
    return null;
  }
  return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
}
