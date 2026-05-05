import { getWallpaperStore } from "@/lib/wallpaper-store";
import { isValidWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { isAdminRequest } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!id)
    return NextResponse.json(
      { code: 400, message: "无效 id" },
      { status: 400 },
    );
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.title !== undefined && String(body.title).trim() === "") {
    return NextResponse.json(
      { code: 400, message: "title 不能为空" },
      { status: 400 },
    );
  }
  if (body.tags !== undefined && String(body.tags).trim() === "") {
    return NextResponse.json(
      { code: 400, message: "tags 不能为空" },
      { status: 400 },
    );
  }
  if (body.groupCode !== undefined) {
    const gc = String(body.groupCode).trim();
    if (!isValidWallpaperGroupCode(gc)) {
      return NextResponse.json(
        { code: 400, message: "groupCode 须为 4～6 位数字" },
        { status: 400 },
      );
    }
    body.groupCode = gc;
  }
  const patch: Record<string, unknown> = {};
  for (const k of [
    "groupCode",
    "fileName",
    "type",
    "theme",
    "title",
    "tags",
    "hotScore",
    "downloading",
    "dailyFeatured",
    "dailyFeaturedSort",
    "hidden",
  ] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const item = await getWallpaperStore().updateWallpaper(id, patch as never);
  if (!item)
    return NextResponse.json({ code: 404, message: "不存在" }, { status: 404 });
  return NextResponse.json({ code: 0, data: item });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!isAdminRequest(_req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!id)
    return NextResponse.json(
      { code: 400, message: "无效 id" },
      { status: 400 },
    );
  const list = await getWallpaperStore().listWallpapers();
  const before = list.some((w) => w.wallpapersId === id);
  if (!before)
    return NextResponse.json({ code: 404, message: "不存在" }, { status: 404 });
  await getWallpaperStore().deleteWallpaper(id);
  return NextResponse.json({ code: 0, data: true });
}
