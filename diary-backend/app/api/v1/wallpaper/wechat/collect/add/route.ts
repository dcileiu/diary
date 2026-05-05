import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 小程序用户收藏壁纸（Bearer 用户 Token）。
 * 已收藏时返回 { already: true }，不报错。
 */
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
  if (!Number.isFinite(wid) || wid < 1) {
    return mpErr(400, "无效壁纸 id");
  }
  const state = await store.collectState(uid, [wid]);
  if (state.some((s) => s.wallpapersId === wid)) {
    const collectCount = await store.collectCount(wid);
    return mpOk({ already: true, collectCount });
  }
  await store.collectAdd(uid, wid);
  const collectCount = await store.collectCount(wid);
  return mpOk({ ok: true, collectCount });
}
