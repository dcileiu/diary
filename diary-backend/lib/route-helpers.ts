import { positiveInt } from "@/lib/validation";

/**
 * 从动态路由 `.../[id]` 的 URL 末段解析数字 ID。
 * 统一实现，替代各 [id]/route.ts 里重复的 readId。
 *
 * 之所以从 pathname 解析而非依赖 context.params：保持各 handler 签名一致，
 * 也便于被路由包装器（withAdmin 等）透明转发。
 */
export function readNumericId(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return positiveInt(parts.at(-1));
}
