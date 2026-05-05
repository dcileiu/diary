import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpUnauthorized } from "@/lib/mp-api";

/** 旧下载日志接口已废弃：为避免绕过扣减逻辑，统一改走 /download/complete。 */
export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  return mpErr(410, "下载日志接口已废弃，请升级客户端");
}

