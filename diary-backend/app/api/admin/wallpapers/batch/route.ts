import { getWallpaperStore } from "@/lib/wallpaper-store";
import { isAdminRequest } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ids?: unknown;
    type?: unknown;
    theme?: unknown;
    tags?: unknown;
    hidden?: unknown;
  };

  const idsRaw = Array.isArray(body.ids) ? body.ids : [];
  const ids = [...new Set(idsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.floor(n)))];

  if (!ids.length) {
    return NextResponse.json(
      { code: 400, message: "ids 不能为空" },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.type !== undefined) {
    const type = String(body.type).trim();
    if (!type) {
      return NextResponse.json(
        { code: 400, message: "type 不能为空" },
        { status: 400 },
      );
    }
    patch.type = type;
  }
  if (body.theme !== undefined) {
    patch.theme = String(body.theme ?? "").trim();
  }
  if (body.tags !== undefined) {
    const tags = String(body.tags).trim();
    if (!tags) {
      return NextResponse.json(
        { code: 400, message: "tags 不能为空" },
        { status: 400 },
      );
    }
    patch.tags = tags;
  }
  if (body.hidden !== undefined) {
    patch.hidden = Boolean(body.hidden);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { code: 400, message: "至少传一个可更新字段" },
      { status: 400 },
    );
  }

  const store = getWallpaperStore();
  const updated = [];
  for (const id of ids) {
    const row = await store.updateWallpaper(id, patch as never);
    if (row) updated.push(row);
  }

  return NextResponse.json({
    code: 0,
    data: {
      updatedCount: updated.length,
      list: updated,
    },
  });
}
