import { adminLogin, isAdminAuthConfigured } from "@/lib/admin-auth";
import { adminJson } from "@/lib/admin-api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  if (!isAdminAuthConfigured()) {
    return adminJson(
      {
        code: 503,
        message: "后台认证未配置，无法登录",
        data: null,
      },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const r = adminLogin(body);
  if (!r) {
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
  return adminJson({ code: 0, data: r });
}
