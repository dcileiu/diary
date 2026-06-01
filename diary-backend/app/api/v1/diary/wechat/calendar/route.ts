import { getDiaryCalendar } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { readJsonBody, withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/calendar",
  "加载日历数据失败",
  async (req, user) => {
    const body = await readJsonBody(req);
    return mpOk(await getDiaryCalendar(user.id, body));
  },
);
