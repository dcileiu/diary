import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    wallpapersId?: number;
    type?: string;
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const wid = Number(body.wallpapersId);
  if (!wid) return mpErr(400, "缺少 wallpapersId");
  await store.collectAdd(uid, wid);
  return mpOk(true);
}
