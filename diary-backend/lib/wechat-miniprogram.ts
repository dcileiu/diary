export class WeChatJsCodeError extends Error {
  readonly errcode: number;

  constructor(errcode: number, message: string) {
    super(message);
    this.name = "WeChatJsCodeError";
    this.errcode = errcode;
  }
}

type JsCode2SessionOk = { openid: string };
type JsCode2SessionErr = { errcode: number; errmsg?: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * 用 wx.login 拿到的 code 换 openid。
 * 生产环境必须配置 WECHAT_MINI_PROGRAM_APP_ID + WECHAT_MINI_PROGRAM_SECRET；
 * 开发环境未配置时使用固定本地 openid，便于无小程序后台时联调。
 */
export async function resolveMiniProgramOpenId(code: string): Promise<string> {
  const appId = process.env.WECHAT_MINI_PROGRAM_APP_ID?.trim();
  const secret = process.env.WECHAT_MINI_PROGRAM_SECRET?.trim();

  if (!appId || !secret) {
    if (process.env.NODE_ENV === "production") {
      throw new WeChatJsCodeError(
        -1,
        "服务端未配置微信小程序 AppId/Secret，无法登录",
      );
    }
    return "__local_dev_openid__";
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      signal: ac.signal,
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "网络异常";
    throw new WeChatJsCodeError(-2, `请求微信接口失败：${msg}`);
  } finally {
    clearTimeout(t);
  }

  const data: unknown = await res.json().catch(() => null);
  if (!isRecord(data)) {
    throw new WeChatJsCodeError(-3, "微信接口返回异常");
  }

  const errcode = data.errcode;
  if (typeof errcode === "number" && errcode !== 0) {
    const errmsg =
      typeof data.errmsg === "string" ? data.errmsg : `错误码 ${errcode}`;
    throw new WeChatJsCodeError(errcode, errmsg);
  }

  const openid = data.openid;
  if (typeof openid !== "string" || !openid.trim()) {
    throw new WeChatJsCodeError(-4, "微信未返回 openid");
  }

  return openid.trim();
}
