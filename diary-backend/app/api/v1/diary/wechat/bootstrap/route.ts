import { getDiaryBootstrap, listDiaryMeta } from "@/lib/diary-service";
import { mpOk } from "@/lib/mp-api";
import { withDiaryUser } from "@/lib/mp-route";

export const POST = withDiaryUser(
  "diary/wechat/bootstrap",
  "加载首页数据失败",
  async (_req, user) => {
    const [bootstrap, meta] = await Promise.all([
      getDiaryBootstrap(user.id),
      listDiaryMeta(),
    ]);
    return mpOk({
      ...bootstrap,
      categories: meta.categories,
      statusOptions: meta.statusOptions,
    });
  },
);
