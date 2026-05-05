import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk, mpServerError } from "@/lib/mp-api";
import { wallpaperWechatApiErrorMessage } from "@/lib/mp-wallpaper-route-error";
import { requestPublicAssetOrigin } from "@/lib/local-upload";
import { withWallpaperAssetUrls } from "@/lib/wallpaper-asset-url";

export async function POST(req: Request) {
  try {
    const data = await getWallpaperStore().indexData();
    return mpOk({
      phoneImages: data.phoneImages.map((x) => withWallpaperAssetUrls(req, x)),
      swiperImages: data.swiperImages.map((x) => withWallpaperAssetUrls(req, x)),
      scrollAvatars: data.scrollAvatars.map((x) => withWallpaperAssetUrls(req, x)),
      assetBase: requestPublicAssetOrigin(req),
    });
  } catch (e) {
    console.error("[wechat/index]", e);
    return mpServerError(wallpaperWechatApiErrorMessage(e));
  }
}
