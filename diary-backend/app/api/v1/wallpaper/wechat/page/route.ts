import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk, mpServerError } from "@/lib/mp-api";
import { wallpaperWechatApiErrorMessage } from "@/lib/mp-wallpaper-route-error";
import { requestPublicAssetOrigin } from "@/lib/local-upload";
import { withWallpaperAssetUrls } from "@/lib/wallpaper-asset-url";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      page?: number;
      limit?: number;
      selectFlag?: number | null;
      type?: string;
      tags?: string;
      groupCode?: string;
      theme?: string;
      search?: string;
    };
    const page = Math.max(1, Number(body.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 12));
    const { records, total } = await getWallpaperStore().pageQuery({
      page,
      limit,
      selectFlag:
        body.selectFlag === null || body.selectFlag === undefined
          ? undefined
          : Number(body.selectFlag),
      type: body.type,
      tags: body.tags,
      groupCode: body.groupCode,
      theme: body.theme,
      search: body.search,
    });
    return mpOk({
      records: records.map((x) => withWallpaperAssetUrls(req, x)),
      total,
      assetBase: requestPublicAssetOrigin(req),
    });
  } catch (e) {
    console.error("[wechat/page]", e);
    return mpServerError(wallpaperWechatApiErrorMessage(e));
  }
}
