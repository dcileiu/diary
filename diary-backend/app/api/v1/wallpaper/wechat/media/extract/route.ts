import { extractOpenMediaHttp } from "@/lib/open-media-extractor-http";
import {
  mpErr,
  mpErrorMessage,
  mpOk,
  mpServerError,
  mpUnauthorized,
} from "@/lib/mp-api";
import { getWallpaperStore } from "@/lib/wallpaper-store";
import { WALLPAPER_MEDIA_EXTRACT_POINTS_COST } from "@/lib/wallpaper-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

type ExtractBody = {
  url?: string;
  input?: string;
  text?: string;
  waitMs?: number | string;
  cookie?: string;
  imageFormat?: string;
  videoPreference?: string;
  index?: number[];
};

function hasExtractedMedia(data: {
  images?: Array<{ url?: string }>;
  videos?: Array<{ url?: string }>;
}) {
  const imageCount = Array.isArray(data?.images)
    ? data.images.filter((item) => String(item?.url || "").trim()).length
    : 0;
  const videoCount = Array.isArray(data?.videos)
    ? data.videos.filter((item) => String(item?.url || "").trim()).length
    : 0;
  return imageCount + videoCount > 0;
}

function parseWaitMs(value: number | string | undefined) {
  const waitMs = Number(value || 3500);
  if (!Number.isFinite(waitMs)) return 3500;
  return Math.max(1000, Math.min(waitMs, 15000));
}

function isClientExtractError(message: string) {
  return /Unsupported host|Invalid article or media URL|not found|timeout|fetch failed|request failed|Douyin extract failed|Xiaohongshu extract failed|提取|解析|链接|请求/i.test(
    message,
  );
}

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();

  if (
    user.isVip !== "2" &&
    user.points < WALLPAPER_MEDIA_EXTRACT_POINTS_COST
  ) {
    return mpErr(
      400,
      `发财鸭不足，去水印需消耗 ${WALLPAPER_MEDIA_EXTRACT_POINTS_COST} 发财鸭`,
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ExtractBody;
    const input = String(body.url || body.input || body.text || "").trim();
    if (!input) {
      return mpErr(400, "缺少链接或分享内容");
    }

    const data = await extractOpenMediaHttp({
      input,
      cookie: body.cookie ? String(body.cookie) : undefined,
      imageFormat: body.imageFormat
        ? (String(body.imageFormat) as
            | "auto"
            | "png"
            | "webp"
            | "jpeg"
            | "heic"
            | "avif")
        : undefined,
      videoPreference: body.videoPreference
        ? (String(body.videoPreference) as "resolution" | "bitrate" | "size")
        : undefined,
      index: Array.isArray(body.index) ? body.index : [],
      waitMs: parseWaitMs(body.waitMs),
    });

    if (!hasExtractedMedia(data)) {
      return mpOk({ detail: data, user });
    }

    const pointsResult = await store.points(user.id, { type: "3" });
    if (!pointsResult) return mpErr(404, "用户不存在");
    if ("err" in pointsResult && pointsResult.err) {
      return mpErr(
        400,
        pointsResult.err === "发财鸭不足"
          ? `发财鸭不足，去水印需消耗 ${WALLPAPER_MEDIA_EXTRACT_POINTS_COST} 发财鸭`
          : pointsResult.err,
      );
    }

    return mpOk({
      detail: data,
      user: "user" in pointsResult ? pointsResult.user : user,
    });
  } catch (error) {
    console.error("[wallpaper/wechat/media/extract]", error);
    const message = mpErrorMessage(error);
    if (isClientExtractError(message)) {
      return mpErr(400, message);
    }
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `解析失败: ${message}`
        : "解析失败，请稍后重试",
    );
  }
}
