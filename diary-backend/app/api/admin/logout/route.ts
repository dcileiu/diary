import { adminJson } from "@/lib/admin-api-response";
import { bearerToken, revokeAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 退出登录：吊销当前令牌对应的会话。
 * 幂等且不要求令牌仍有效——无论令牌是否存在都返回成功，避免泄漏令牌有效性。
 */
export async function POST(req: Request) {
  await revokeAdminSession(bearerToken(req));
  return adminJson({ code: 0, data: true });
}
