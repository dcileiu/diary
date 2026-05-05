import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";
import {
  getWechatArticleDetail,
  type WechatArticleDetailParams,
} from "@/lib/wechat-article-detail";

export const runtime = "nodejs";
const RATE_LIMIT_WINDOW_MS = 5000;
const lastRequestAt = new Map<string, number>();

type DetailRequestBody = {
  url?: string;
  cookie?: string;
  index?: number[];
};

function clientKey(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  const cfIp = req.headers.get("cf-connecting-ip") || "";
  const ip = xff.split(",")[0]?.trim() || realIp.trim() || cfIp.trim() || "unknown";
  return `ip:${ip}`;
}

function hitRateLimit(req: Request) {
  const key = clientKey(req);
  const now = Date.now();
  const prev = lastRequestAt.get(key) ?? 0;
  if (now - prev < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  lastRequestAt.set(key, now);
  if (lastRequestAt.size > 5000) {
    for (const [k, ts] of lastRequestAt.entries()) {
      if (now - ts > RATE_LIMIT_WINDOW_MS * 2) lastRequestAt.delete(k);
    }
  }
  return false;
}

export async function POST(req: Request) {
  try {
    if (hitRateLimit(req)) {
      return mpErr(429, "请求过于频繁，请 5 秒后再试");
    }
    const body = (await req.json().catch(() => ({}))) as DetailRequestBody;
    const url = String(body.url ?? "").trim();
    if (!url) {
      return mpErr(400, "缺少参数: url");
    }

    const params: WechatArticleDetailParams = {
      url,
      cookie: body.cookie ? String(body.cookie) : undefined,
      index: Array.isArray(body.index) ? body.index : undefined,
    };
    const result = await getWechatArticleDetail(params);
    return mpOk(result);
  } catch (e) {
    console.error("[wechat/detail]", e);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `解析失败: ${mpErrorMessage(e)}`
        : "服务暂不可用，请稍后重试",
    );
  }
}
