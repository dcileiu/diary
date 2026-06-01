import { isAdminAuthConfigured, verifyAdminCredentials } from "@/lib/admin-auth";
import { adminJson } from "@/lib/admin-api-response";
import { createAdminSession } from "@/lib/admin-session";
import { logError } from "@/lib/logger";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit(`admin-login:${ip}`, 10, 60_000);
  if (!limited.allowed) {
    return adminJson(
      { code: 429, message: "尝试过于频繁，请稍后再试", data: null },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  if (!isAdminAuthConfigured()) {
    return adminJson(
      { code: 503, message: "后台认证未配置，无法登录", data: null },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const credentials = verifyAdminCredentials(body);
  if (!credentials) {
    return adminJson(
      {
        code: 401,
        message: "账号或密码错误",
        data: null,
        hint: "联系管理员要账号密码。",
      },
      { status: 401 },
    );
  }

  try {
    const session = await createAdminSession({
      username: credentials.username,
      ip,
      userAgent: req.headers.get("user-agent") ?? "",
    });
    return adminJson({
      code: 0,
      data: {
        accessToken: session.token,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logError("admin/login", error);
    return adminJson(
      { code: 500, message: "登录服务异常，请稍后重试", data: null },
      { status: 500 },
    );
  }
}
