import { mpOk, mpServerError, mpUnauthorized } from "@/lib/mp-api";
import {
  listDiaryMeta,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";

export async function POST(req: Request) {
  try {
    const user = await resolveDiaryUserFromRequest(req);
    if (!user) return mpUnauthorized();
    return mpOk(await listDiaryMeta());
  } catch (error) {
    console.error("[diary/wechat/meta]", error);
    return mpServerError("加载基础配置失败");
  }
}
