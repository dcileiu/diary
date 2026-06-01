import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-session";

/** 校验后台会话令牌；未授权返回 401 响应，授权通过返回 null。 */
export async function ensureAdmin(req: Request): Promise<NextResponse | null> {
  if (await isAuthorizedAdminRequest(req)) {
    return null;
  }
  return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
}
