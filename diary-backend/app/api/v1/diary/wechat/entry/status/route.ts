import { mpErr, mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  DiaryNotFoundError,
  resolveDiaryUserFromRequest,
  updateDiaryEntryStatusForUser,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as {
      entryId?: unknown;
      status?: unknown;
    };
    const entryId = Number(body.entryId);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return mpErr(400, "缺少条目 ID");
    }
    const entry = await updateDiaryEntryStatusForUser(user.id, entryId, body.status);
    return mpOk({ entry });
  } catch (error) {
    if (error instanceof DiaryNotFoundError) {
      return mpErr(404, error.message);
    }
    console.error("[diary/wechat/entry/status]", error);
    return mpServerError("更新状态失败");
  }
}
