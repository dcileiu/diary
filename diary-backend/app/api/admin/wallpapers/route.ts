import { getWallpaperStore } from "@/lib/wallpaper-store";
import { isValidWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { isAdminRequest } from "@/lib/admin-auth";
import { adminJson } from "@/lib/admin-api-response";
import { wallpaperAdminStoreErrorMessage } from "@/lib/mp-wallpaper-route-error";
import { requestPublicAssetOrigin } from "@/lib/local-upload";
import type { WallItem } from "@/lib/wallpaper-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const pageRaw = parseInt(url.searchParams.get("page") || "1", 10);
    const limitRaw = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 10;
    const visible = String(url.searchParams.get("visible") || "all");
    const featured = String(url.searchParams.get("featured") || "all");
    const hasFilter =
      visible === "show" ||
      visible === "hide" ||
      featured === "featured" ||
      featured === "normal";
    const store = getWallpaperStore();
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    let list: WallItem[] = [];
    let total = 0;
    let p = 1;
    let lim = safeLimit;
    if (!hasFilter) {
      const paged = await store.listWallpapersPaged(page, limit);
      list = paged.list;
      total = paged.total;
      p = paged.page;
      lim = paged.limit;
    } else {
      const all = await store.listWallpapers();
      const filtered = all.filter((w) => {
        if (visible === "show" && (w.hidden ?? false)) return false;
        if (visible === "hide" && !(w.hidden ?? false)) return false;
        if (featured === "featured" && !(w.dailyFeatured ?? false)) return false;
        if (featured === "normal" && (w.dailyFeatured ?? false)) return false;
        return true;
      });
      total = filtered.length;
      const maxPage = Math.max(1, Math.ceil(total / safeLimit) || 1);
      p = Math.min(maxPage, Math.max(1, Math.floor(page)));
      lim = safeLimit;
      list = filtered.slice((p - 1) * lim, (p - 1) * lim + lim);
    }
    return adminJson({
      code: 0,
      data: { list, total, page: p, limit: lim, assetBase: requestPublicAssetOrigin(req) },
    });
  } catch (e) {
    console.error("[admin/wallpapers GET]", e);
    return adminJson({
      code: 500,
      message: wallpaperAdminStoreErrorMessage(e),
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fileName?: string;
      type?: string;
      theme?: string;
      title?: string;
      tags?: string;
      groupCode?: string;
      hotScore?: number;
    };
    const fileName = String(body.fileName ?? "").trim();
    const type = String(body.type ?? "").trim();
    const theme = String(body.theme ?? "").trim();
    const title = String(body.title ?? "").trim();
    const tags = String(body.tags ?? "").trim();
    const groupCode = String(body.groupCode ?? "").trim();
    if (!fileName || !type || !title || !tags) {
      return NextResponse.json(
        { code: 400, message: "fileName、type、title、tags 均为必填" },
        { status: 400 },
      );
    }
    if (!isValidWallpaperGroupCode(groupCode)) {
      return NextResponse.json(
        {
          code: 400,
          message: "groupCode 须为 4～6 位数字；同批多张请传相同编号",
        },
        { status: 400 },
      );
    }
    const item = await getWallpaperStore().upsertWallpaper({
      fileName,
      type,
      theme,
      title,
      tags,
      groupCode,
      hotScore: body.hotScore,
    });
    return NextResponse.json({ code: 0, data: item });
  } catch (e) {
    console.error("[admin/wallpapers POST]", e);
    return adminJson({
      code: 500,
      message: wallpaperAdminStoreErrorMessage(e),
    }, { status: 500 });
  }
}
