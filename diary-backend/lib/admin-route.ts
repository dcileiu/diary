import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { logError } from "@/lib/logger";
import { mapPrismaError } from "@/lib/prisma-error";

export type AdminRouteHandler = (req: Request) => Promise<Response>;

/**
 * 管理后台接口统一包装：
 * 1) 鉴权（失败 → 401）；
 * 2) 统一异常处理：已知 Prisma 错误翻译成友好提示，其余记日志 + 500；
 *
 * 之前各 admin route 没有 try/catch，唯一约束等错误会直接抛成无文案的 500。
 * 包装后既消除重复的鉴权样板，又让错误响应稳定可读。
 *
 * 注意：Next 要求 `dynamic` / `revalidate` 等段配置仍由各 route 文件自身导出。
 */
export function withAdmin(
  scope: string,
  handler: AdminRouteHandler,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const denied = await ensureAdmin(req);
    if (denied) return denied;

    try {
      return await handler(req);
    } catch (error) {
      const friendly = mapPrismaError(error);
      if (friendly) {
        return adminJson(
          { code: friendly.status, message: friendly.message, data: null },
          { status: friendly.status },
        );
      }
      logError(scope, error);
      return adminJson(
        { code: 500, message: "服务异常，请稍后重试", data: null },
        { status: 500 },
      );
    }
  };
}
