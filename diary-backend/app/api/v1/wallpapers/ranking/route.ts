import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpOk } from "@/lib/mp-api";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { num?: number };
  const num = Math.min(50, Math.max(1, Number(body.num) || 10));
  const data = await getWallpaperStore().ranking(num);
  return mpOk(data);
}
