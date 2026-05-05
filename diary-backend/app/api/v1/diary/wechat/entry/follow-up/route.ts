import { mpErr, mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  addDiaryFollowUpForUser,
  DiaryInputError,
  DiaryNotFoundError,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const entry = await addDiaryFollowUpForUser(user.id, body);
    return mpOk({ entry });
  } catch (error) {
    if (error instanceof DiaryInputError) {
      return mpErr(400, error.message);
    }
    if (error instanceof DiaryNotFoundError) {
      return mpErr(404, error.message);
    }
    console.error("[diary/wechat/entry/follow-up]", error);
    return mpServerError("新增跟进记录失败");
  }
}
