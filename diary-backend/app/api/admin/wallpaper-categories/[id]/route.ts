import { getWallpaperStore } from "@/lib/wallpaper-store";
import { isAdminRequest } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!id) {
    return NextResponse.json({ code: 400, message: "无效 id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sortOrder?: number;
  };
  const patch: { name?: string; sortOrder?: number } = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder);
  const item = await getWallpaperStore().updateWallpaperCategory(id, patch);
  if (!item) {
    return NextResponse.json(
      { code: 400, message: "更新失败（不存在或名称冲突）" },
      { status: 400 },
    );
  }
  return NextResponse.json({ code: 0, data: item });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!isAdminRequest(_req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!id) {
    return NextResponse.json({ code: 400, message: "无效 id" }, { status: 400 });
  }
  const r = await getWallpaperStore().deleteWallpaperCategory(id);
  if (!r.ok) {
    const msg =
      r.reason === "in_use"
        ? "该分类下仍有壁纸（type 引用），请先调整壁纸类型再删"
        : "分类不存在";
    return NextResponse.json({ code: 400, message: msg }, { status: 400 });
  }
  return NextResponse.json({ code: 0, data: true });
}
