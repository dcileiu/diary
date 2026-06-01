import { listDiaryEntriesForUser } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/entries",
  "加载条目列表失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    return mpOk(await listDiaryEntriesForUser(user.id, body));
  },
);
