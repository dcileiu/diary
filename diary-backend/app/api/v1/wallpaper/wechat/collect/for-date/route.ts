import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    page?: number;
    limit?: number;
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const page = Math.max(1, Number(body.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(body.limit) || 20));
  const { records, total } = await store.collectForDate(uid, page, limit);
  return mpOk({ records, total });
}
