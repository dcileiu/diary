import { mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  listDiaryEntriesForUser,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return mpOk(await listDiaryEntriesForUser(user.id, body));
  } catch (error) {
    console.error("[diary/wechat/entries]", error);
    return mpServerError("加载条目列表失败");
  }
}
