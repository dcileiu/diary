import { isAdminRequest } from "@/lib/admin-auth";
import { getWallpaperStore } from "@/lib/wallpaper-store";
import { adminJson } from "@/lib/admin-api-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const list = await getWallpaperStore().listWallpaperTags();
  return adminJson({ code: 0, data: { list, total: list.length } });
}

export async function POST(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sortOrder?: number;
  };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { code: 400, message: "name 必填" },
      { status: 400 },
    );
  }
  const item = await getWallpaperStore().createWallpaperTag(
    name,
    body.sortOrder,
  );
  if (!item) {
    return NextResponse.json(
      { code: 400, message: "名称重复或无效" },
      { status: 400 },
    );
  }
  return adminJson({ code: 0, data: item });
}
