import { getWallpaperStore } from "@/lib/wallpaper-store";
import { isAdminRequest } from "@/lib/admin-auth";
import { adminJson } from "@/lib/admin-api-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const list = await getWallpaperStore().listUsersForAdmin();
  return adminJson({ code: 0, data: { list, total: list.length } });
}
