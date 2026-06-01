import { getDiaryEntryDetailForUser } from "@/lib/diary-service";
import { mpErr, mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";
import { positiveInt } from "@/lib/validation";

export const POST = withDiaryUser(
  "diary/wechat/entry/detail",
  "加载条目详情失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    const entryId = positiveInt(body.entryId);
    if (!entryId) return mpErr(400, "缺少条目 ID");
    return mpOk({ entry: await getDiaryEntryDetailForUser(user.id, entryId) });
  },
);
