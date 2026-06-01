import { getDiaryStats } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/stats",
  "加载统计数据失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    return mpOk(await getDiaryStats(user.id, body));
  },
);
