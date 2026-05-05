import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";
import { extractOpenMediaHttp } from "@/lib/open-media-extractor-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const RATE_LIMIT_WINDOW_MS = 8000;
const lastRequestAt = new Map<string, number>();

function applyCors(response: Response) {
  response.headers.set(
    "Access-Control-Allow-Origin",
    process.env.OPEN_MEDIA_EXTRACT_ALLOW_ORIGIN?.trim() || "*",
  );
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-api-key",
  );
  response.headers.set("Vary", "Origin");
  return response;
}

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
    for (const [cacheKey, ts] of lastRequestAt.entries()) {
      if (now - ts > RATE_LIMIT_WINDOW_MS * 2) {
        lastRequestAt.delete(cacheKey);
      }
    }
  }
  return false;
}

function assertApiKey(req: Request) {
  const expected = process.env.OPEN_MEDIA_EXTRACT_API_KEY?.trim();
  if (!expected) {
    return { ok: true as const };
  }
  const got =
    req.headers.get("x-api-key")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!got || got !== expected) {
    return { ok: false as const, status: 401, msg: "Unauthorized" };
  }
  return { ok: true as const };
}

async function readInput(req: Request) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    return {
      input:
        url.searchParams.get("url") ||
        url.searchParams.get("input") ||
        url.searchParams.get("text") ||
        "",
      waitMs: Number(url.searchParams.get("waitMs") || 3500),
      cookie: url.searchParams.get("cookie") || undefined,
      imageFormat: url.searchParams.get("imageFormat") || undefined,
      videoPreference: url.searchParams.get("videoPreference") || undefined,
      index: url.searchParams
        .getAll("index")
        .flatMap((value) => String(value).split(","))
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0),
    };
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    input?: string;
    text?: string;
    waitMs?: number | string;
    cookie?: string;
    imageFormat?: string;
    videoPreference?: string;
    index?: number[];
  };
  return {
    input: String(body.url || body.input || body.text || ""),
    waitMs: Number(body.waitMs || 3500),
    cookie: body.cookie ? String(body.cookie) : undefined,
    imageFormat: body.imageFormat ? String(body.imageFormat) : undefined,
    videoPreference: body.videoPreference ? String(body.videoPreference) : undefined,
    index: Array.isArray(body.index) ? body.index : [],
  };
}

export function OPTIONS() {
  return applyCors(new Response(null, { status: 204 }));
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  try {
    const auth = assertApiKey(req);
    if (!auth.ok) {
      return applyCors(mpErr(auth.status, auth.msg));
    }
    if (hitRateLimit(req)) {
      return applyCors(
        mpErr(429, "Requests are too frequent. Please retry after a few seconds."),
      );
    }

    const { input, waitMs, cookie, imageFormat, videoPreference, index } =
      await readInput(req);
    if (!input.trim()) {
      return applyCors(mpErr(400, "Missing parameter: url/input/text"));
    }

    const data = await extractOpenMediaHttp({
      input,
      cookie,
      imageFormat: imageFormat as
        | "auto"
        | "png"
        | "webp"
        | "jpeg"
        | "heic"
        | "avif"
        | undefined,
      videoPreference: videoPreference as
        | "resolution"
        | "bitrate"
        | "size"
        | undefined,
      index,
      waitMs: Number.isFinite(waitMs) ? Math.max(1000, Math.min(waitMs, 15000)) : 3500,
    });
    return applyCors(mpOk(data));
  } catch (error) {
    console.error("[open/media/extract]", error);
    const message =
      process.env.NODE_ENV === "development"
        ? `Extract failed: ${mpErrorMessage(error)}`
        : "Service is temporarily unavailable.";
    return applyCors(
      /Unsupported host|Invalid article or media URL|not found/i.test(
        mpErrorMessage(error),
      )
        ? mpErr(400, mpErrorMessage(error))
        : mpServerError(message),
    );
  }
}
