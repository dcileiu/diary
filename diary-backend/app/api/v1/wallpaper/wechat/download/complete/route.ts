import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

/** 保存到相册成功后调用：原子写下载记录，并在非 VIP 时扣减发财鸭。 */
export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    wallpapersId?: unknown;
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const wid = Number(body.wallpapersId);
  if (!Number.isFinite(wid) || wid <= 0) return mpErr(400, "无效 wallpapersId");
  const result = await store.completeDownload(uid, Math.floor(wid));
  if (!result) return mpErr(404, "用户不存在");
  if ("err" in result && result.err) {
    return mpErr(result.err === "壁纸不存在" ? 404 : 400, result.err);
  }
  if (!("user" in result)) {
    return mpErr(500, "下载同步结果异常");
  }
  return mpOk(result.user);
}
