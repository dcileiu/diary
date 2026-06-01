import { updateDiaryEntryStatusForUser } from "@/lib/diary-service";
import { mpErr, mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";
import { positiveInt } from "@/lib/validation";

export const POST = withDiaryUser(
  "diary/wechat/entry/status",
  "更新状态失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    const entryId = positiveInt(body.entryId);
    if (!entryId) return mpErr(400, "缺少条目 ID");
    const entry = await updateDiaryEntryStatusForUser(user.id, entryId, body.status);
    return mpOk({ entry });
  },
);
