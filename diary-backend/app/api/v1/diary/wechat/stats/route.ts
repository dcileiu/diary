import { mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  getDiaryStats,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return mpOk(await getDiaryStats(user.id, body));
  } catch (error) {
    console.error("[diary/wechat/stats]", error);
    return mpServerError("加载统计数据失败");
  }
}
