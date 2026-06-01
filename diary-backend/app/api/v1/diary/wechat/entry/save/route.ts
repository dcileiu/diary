import { saveDiaryEntryForUser } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/entry/save",
  "保存条目失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    const entry = await saveDiaryEntryForUser(user.id, body);
    return mpOk({ entry });
  },
);
