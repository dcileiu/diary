import { listDiaryMeta } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/meta",
  "加载基础配置失败",
  async () => mpOk(await listDiaryMeta()),
);
