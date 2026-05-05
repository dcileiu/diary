/**
 * 微信小程序图片内容安全（同步 img_sec_check）
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/imgSecCheck.html
 */
import {
  getWeChatMiniProgramAccessToken,
  invalidateWeChatMiniProgramAccessToken,
} from "@/lib/wechat-mini-access-token";

/** 与文档一致：图片文件大小不超过 1MB */
export const WECHAT_IMG_SEC_CHECK_MAX_BYTES = 1024 * 1024;

export function isWechatImgSecCheckSkipped(): boolean {
  const v = process.env.WECHAT_IMG_SEC_CHECK_SKIP?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type WechatImgSecCheckResult =
  | { ok: true }
  | { ok: false; errcode: number; errmsg: string };

function mapUserMessage(errcode: number, errmsg: string): string {
  if (errcode === 87014) return "图片未通过内容安全检测，请更换图片";
  if (errcode === 40099) return "图片格式或尺寸不符合微信检测要求（建议 JPG/PNG/GIF，≤1MB，边长不宜过大）";
  if (errcode === 40001 || errcode === 42001) return "微信接口鉴权失败，请稍后重试";
  if (errcode === -2) return "图片安全检测服务暂不可用，请稍后重试";
  if (errcode === -1 && errmsg) return errmsg;
  return errmsg || `内容安全检测失败(${errcode})`;
}

export function formatImgSecCheckFailure(r: {
  ok: false;
  errcode: number;
  errmsg: string;
}): string {
  return mapUserMessage(r.errcode, r.errmsg);
}

/**
 * 将图片二进制发往微信检测。需在服务端调用（携带 secret 换 token）。
 * 开发环境可设 WECHAT_IMG_SEC_CHECK_SKIP=1 跳过（勿用于生产）。
 */
export async function wechatImgSecCheckBytes(
  imageBytes: ArrayBuffer,
): Promise<WechatImgSecCheckResult> {
  if (imageBytes.byteLength === 0) {
    return { ok: false, errcode: -1, errmsg: "空文件" };
  }
  if (imageBytes.byteLength > WECHAT_IMG_SEC_CHECK_MAX_BYTES) {
    return {
      ok: false,
      errcode: -1,
      errmsg: `图片须不超过 ${WECHAT_IMG_SEC_CHECK_MAX_BYTES / 1024 / 1024}MB（微信 img_sec_check 限制）`,
    };
  }

  if (isWechatImgSecCheckSkipped()) {
    return { ok: true };
  }

  try {
    const postOnce = async (): Promise<WechatImgSecCheckResult> => {
      const token = await getWeChatMiniProgramAccessToken();
      const url = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: imageBytes,
      });
      let j: { errcode?: number; errmsg?: string };
      try {
        j = (await res.json()) as { errcode?: number; errmsg?: string };
      } catch {
        return { ok: false, errcode: -1, errmsg: "微信接口返回非 JSON" };
      }
      const code = j.errcode ?? 0;
      if (code === 0) return { ok: true };
      return { ok: false, errcode: code, errmsg: j.errmsg ?? "" };
    };

    let out = await postOnce();
    if (!out.ok && (out.errcode === 40001 || out.errcode === 42001)) {
      invalidateWeChatMiniProgramAccessToken();
      out = await postOnce();
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, errcode: -2, errmsg: msg };
  }
}
