import { mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  getDiaryBootstrap,
  listDiaryMeta,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();

    const [bootstrap, meta] = await Promise.all([
      getDiaryBootstrap(user.id),
      listDiaryMeta(),
    ]);

    return mpOk({
      ...bootstrap,
      categories: meta.categories,
      statusOptions: meta.statusOptions,
    });
  } catch (error) {
    console.error("[diary/wechat/bootstrap]", error);
    return mpServerError("加载首页数据失败");
  }
}
