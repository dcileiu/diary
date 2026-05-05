import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";
import { loginOrRegisterDiaryUser } from "@/lib/diary-service";
import {
  resolveMiniProgramOpenId,
  WeChatJsCodeError,
} from "@/lib/wechat-miniprogram";

export async function POST(req: Request) {
  try {
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
      console.error("[diary/wechat/login] openid", error);
      return mpServerError(
        process.env.NODE_ENV === "development"
          ? `换取 openid 失败: ${mpErrorMessage(error)}`
          : "微信登录服务异常，请稍后重试",
      );
    }
  } catch (error) {
    console.error("[diary/wechat/login]", error);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `登录失败: ${mpErrorMessage(error)}`
        : "登录失败，请稍后重试",
    );
  }
}
