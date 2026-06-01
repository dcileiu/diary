import type { WxUser } from "@prisma/client";

import {
  DiaryInputError,
  DiaryNotFoundError,
  resolveDiaryUserFromRequest,
} from "@/lib/diary-service";
import { logError } from "@/lib/logger";
import { mpErr, mpServerError, mpUnauthorized } from "@/lib/mp-api";

export type DiaryRouteHandler = (
  req: Request,
  user: WxUser,
) => Promise<Response>;

/**
 * 小程序数据接口统一包装：
 * 1) 解析并校验登录态（失败 → 401）；
 * 2) 统一异常映射：DiaryInputError → 400、DiaryNotFoundError → 404、其余 → 记日志 + 500；
 *
 * 这样每个 route 只需关注“拿到 user 之后做什么”，消除了 8 个文件里几乎相同的 try/catch 样板，
 * 也保证错误响应格式与日志口径完全一致。
 *
 * @param scope          日志定位用的接口名，如 "diary/wechat/entry/save"
 * @param failureMessage 未知异常时返回给客户端的友好文案（不泄漏内部细节）
 */
export function withDiaryUser(
  scope: string,
  failureMessage: string,
  handler: DiaryRouteHandler,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    let user: WxUser | null;
    try {
      user = await resolveDiaryUserFromRequest(req);
    } catch (error) {
      logError(scope, error);
      return mpServerError(failureMessage);
    }
    if (!user) return mpUnauthorized();

    try {
      return await handler(req, user);
    } catch (error) {
      if (error instanceof DiaryInputError) return mpErr(400, error.message);
      if (error instanceof DiaryNotFoundError) return mpErr(404, error.message);
      logError(scope, error);
      return mpServerError(failureMessage);
    }
  };
}

/** 最佳努力解析 JSON body；非法/空 body 返回空对象，避免每个 route 重复写 catch。 */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
