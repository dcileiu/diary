import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as { uid?: string };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const data = await store.actionCount(uid);
  return mpOk(data);
}
