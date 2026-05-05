import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    uid?: string;
    nickname?: string;
  };
  const uid = body.uid ?? user.id;
  if (uid !== user.id) return mpUnauthorized();
  const nickname = String(body.nickname ?? "").trim();
  if (!nickname) return mpErr(400, "昵称为空");
  const updated = await store.updateNickname(uid, nickname);
  if (!updated) return mpErr(404, "用户不存在");
  return mpOk(updated);
}
