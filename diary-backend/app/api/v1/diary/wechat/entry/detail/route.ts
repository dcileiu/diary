import { mpErr, mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  DiaryNotFoundError,
  getDiaryEntryDetailForUser,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as { entryId?: unknown };
    const entryId = Number(body.entryId);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return mpErr(400, "缺少条目 ID");
    }
    return mpOk({
      entry: await getDiaryEntryDetailForUser(user.id, entryId),
    });
  } catch (error) {
    if (error instanceof DiaryNotFoundError) {
      return mpErr(404, error.message);
    }
    console.error("[diary/wechat/entry/detail]", error);
    return mpServerError("加载条目详情失败");
  }
}
