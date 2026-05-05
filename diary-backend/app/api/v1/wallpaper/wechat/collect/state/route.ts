import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    wallpapersIds?: number[];
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const ids = Array.isArray(body.wallpapersIds) ? body.wallpapersIds : [];
  const data = await store.collectState(uid, ids);
  return mpOk(data);
}
