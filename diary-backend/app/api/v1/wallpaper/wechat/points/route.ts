import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    type?: string;
    operation?: string;
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const type = String(body.type ?? "");
  if (!type) return mpErr(400, "缺少 type");
  const r = await store.points(uid, {
    type,
    operation: body.operation,
  });
  if (!r) return mpErr(404, "用户不存在");
  if ("err" in r && r.err) return mpErr(400, r.err);
  if ("user" in r) return mpOk(r.user);
  return mpOk(user);
}
