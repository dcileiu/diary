import { getWallpaperStore } from "@/lib/wallpaper-store";
import { MINI_PROGRAM_DEFAULT_AVATAR_URL } from "@/lib/wx-user-defaults";
import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";
import {
  resolveMiniProgramOpenId,
  WeChatJsCodeError,
} from "@/lib/wechat-miniprogram";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      inviterId?: string;
    };
    const code = body.code;
    if (!code || typeof code !== "string") {
      return mpErr(400, "缺少 code");
    }
    let openId: string;
    try {
      openId = await resolveMiniProgramOpenId(code);
    } catch (e) {
      if (e instanceof WeChatJsCodeError) {
        return mpErr(400, e.message);
      }
      console.error("[wechat/login] openid", e);
      return mpServerError(
        process.env.NODE_ENV === "development"
          ? `换取 openid 失败: ${mpErrorMessage(e)}`
          : "微信登录服务异常，请稍后重试",
      );
    }
    const user = await getWallpaperStore().loginByOpenId(openId, {
      defaultAvatarUrl: MINI_PROGRAM_DEFAULT_AVATAR_URL,
      inviterId: body.inviterId,
    });
    return mpOk(user);
  } catch (e) {
    console.error("[wechat/login]", e);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `服务器错误: ${mpErrorMessage(e)}`
        : "登录失败，请稍后重试（检查数据库与微信 AppId/Secret）",
    );
  }
}
