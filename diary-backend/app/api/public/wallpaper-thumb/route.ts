import { NextResponse } from "next/server";

import { getOrCreateWallpaperThumb } from "@/lib/wallpaper-thumbnail";

export const runtime = "nodejs";

/**
 * 壁纸列表用小图：GET ?f=fileName
 * - 首次请求时从原图生成 WebP 缩略图并缓存到磁盘
 * - 小程序 / 后台列表同源引用，预览大图仍走 `/uploads/wallpapers/{fileName}`
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const f = u.searchParams.get("f")?.trim() ?? "";
  const result = await getOrCreateWallpaperThumb(f);
  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
