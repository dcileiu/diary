import { addDiaryFollowUpForUser } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/entry/follow-up",
  "新增跟进记录失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    const entry = await addDiaryFollowUpForUser(user.id, body);
    return mpOk({ entry });
  },
);
