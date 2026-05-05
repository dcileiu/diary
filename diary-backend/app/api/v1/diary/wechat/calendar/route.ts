import { mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  getDiaryCalendar,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return mpOk(await getDiaryCalendar(user.id, body));
  } catch (error) {
    console.error("[diary/wechat/calendar]", error);
    return mpServerError("加载日历数据失败");
  }
}
