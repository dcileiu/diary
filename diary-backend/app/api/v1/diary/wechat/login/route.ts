import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";
import { loginOrRegisterDiaryUser } from "@/lib/diary-service";
import { logError } from "@/lib/logger";
import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import {
  resolveMiniProgramOpenId,
  WeChatJsCodeError,
} from "@/lib/wechat-miniprogram";

export async function POST(req: Request) {
  try {
    const ip = clientIpFromRequest(req);
    const limited = checkRateLimit(`wechat-login:${ip}`, 30, 60_000);
    if (!limited.allowed) {
      return mpErr(429, "登录请求过于频繁，请稍后再试");
    }

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
    };
    if (!body.code || typeof body.code !== "string") {
      return mpErr(400, "缺少 code");
    }

    try {
      const openId = await resolveMiniProgramOpenId(body.code);
      return mpOk(await loginOrRegisterDiaryUser(openId, req));
    } catch (error) {
      if (error instanceof WeChatJsCodeError) {
        return mpErr(400, error.message);
      }
      logError("diary/wechat/login:openid", error);
      return mpServerError(
        process.env.NODE_ENV === "development"
          ? `换取 openid 失败: ${mpErrorMessage(error)}`
          : "微信登录服务异常，请稍后重试",
      );
    }
  } catch (error) {
    logError("diary/wechat/login", error);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `登录失败: ${mpErrorMessage(error)}`
        : "登录失败，请稍后重试",
    );
  }
}
