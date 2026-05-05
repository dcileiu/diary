/**
 * 小程序服务端调用微信开放接口用的 access_token（client_credential），与用户登录 token 无关。
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-access-token/getAccessToken.html
 */

let cache: { token: string; expireAt: number } | null = null;
let inFlight: Promise<string> | null = null;

export function invalidateWeChatMiniProgramAccessToken() {
  cache = null;
  inFlight = null;
}

export async function getWeChatMiniProgramAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && now < cache.expireAt - 60_000) return cache.token;
  if (inFlight) return inFlight;

  const appId = process.env.WECHAT_MINI_PROGRAM_APP_ID?.trim();
  const secret = process.env.WECHAT_MINI_PROGRAM_SECRET?.trim();
  if (!appId || !secret) {
    throw new Error("缺少 WECHAT_MINI_PROGRAM_APP_ID / WECHAT_MINI_PROGRAM_SECRET");
  }

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);

  inFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
      };

      if (res.ok && data.access_token) {
        const sec = data.expires_in ?? 7200;
        cache = { token: data.access_token, expireAt: Date.now() + sec * 1000 };
        return data.access_token;
      }

      throw new Error(data.errmsg || `获取微信 access_token 失败（HTTP ${res.status}）`);
    } finally {
      clearTimeout(timeout);
      inFlight = null;
    }
  })();

  return inFlight;
}
