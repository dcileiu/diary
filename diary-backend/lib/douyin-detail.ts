import {
  extractAssignedValueFromHtml,
  extractExpressionValueFromText,
} from "@/lib/script-data-extractor";

const DOUYIN_SHORT_REGEX =
  /(?:https?:\/\/)?v\.douyin\.com\/[A-Za-z0-9_-]+\/?/gi;
const DOUYIN_WEB_REGEX =
  /(?:https?:\/\/)?(?:(?:www|m)\.)?(?:douyin|iesdouyin)\.com\/[^\s"'<>\\^`{|}]+|(?:https?:\/\/)?(?:www\.)?amemv\.com\/[^\s"'<>\\^`{|}]+/gi;
const PACE_PAYLOAD_REGEX =
  /self\.__pace_f\.push\(\[1,\s*("(?:\\.|[^"\\])*")\]\)/g;
const DOUYIN_REFERER = "https://www.douyin.com/";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export type DouyinVideoPreference = "resolution" | "bitrate" | "size";

export type DouyinDetailParams = {
  url: string;
  videoPreference?: DouyinVideoPreference;
  cookie?: string;
  index?: number[];
};

export type DouyinDetailData = {
  id: string;
  url: string;
  title: string;
  desc: string;
  type: "图文" | "图集" | "视频" | "未知";
  authorName: string;
  authorId: string;
  authorUrl: string;
  likedCount: number;
  collectedCount: number;
  commentCount: number;
  shareCount: number;
  tags: string[];
  downloadUrls: string[];
  liveUrls: Array<string | null>;
};

export type DouyinDetailResult = {
  message: "success" | "failed" | string;
  params: DouyinDetailParams;
  data: DouyinDetailData | null;
};

type RequestOptions = {
  cookie?: string;
  referer?: string;
  userAgent?: string;
};

type ImageCandidate = {
  url: string;
  area: number;
  position: number;
};

function normalizeWebUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

function ensureAllowedHost(raw: string) {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  if (
    host !== "v.douyin.com" &&
    host !== "douyin.com" &&
    host !== "www.douyin.com" &&
    host !== "m.douyin.com" &&
    host !== "iesdouyin.com" &&
    host !== "www.iesdouyin.com" &&
    host !== "amemv.com" &&
    host !== "www.amemv.com"
  ) {
    throw new Error("不支持的链接域名");
  }
}

function extractCandidateLinks(text: string): string[] {
  if (!text?.trim()) return [];
  const matches = [
    ...Array.from(text.matchAll(DOUYIN_SHORT_REGEX), (m) => normalizeWebUrl(m[0])),
    ...Array.from(text.matchAll(DOUYIN_WEB_REGEX), (m) => normalizeWebUrl(m[0])),
  ];
  return [...new Set(matches)];
}

async function request(url: string, options: RequestOptions = {}) {
  const normalized = normalizeWebUrl(url);
  ensureAllowedHost(normalized);
  const referer = String(options.referer ?? DOUYIN_REFERER).trim();
  const origin = referer ? new URL(referer).origin : "";
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const response = await fetch(normalized, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      priority: "u=0, i",
      "sec-ch-ua":
        '"Google Chrome";v="143", "Chromium";v="143", "Not=A?Brand";v="24"',
      "sec-ch-ua-mobile": /\bMobile\b/i.test(userAgent) ? "?1" : "?0",
      "sec-ch-ua-platform": /\biPhone\b/i.test(userAgent) ? '"iOS"' : '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": referer ? "same-site" : "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent": userAgent,
      ...(origin ? { origin } : {}),
      ...(referer ? { referer } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }
  return response;
}

async function resolveUrl(url: string, options: RequestOptions = {}) {
  const response = await request(url, options);
  return response.url;
}

async function extractLinks(text: string, options: RequestOptions = {}) {
  const candidates = extractCandidateLinks(text);
  const out: string[] = [];
  for (const candidate of candidates) {
    let link = candidate;
    if (/v\.douyin\.com/i.test(candidate)) {
      try {
        link = await resolveUrl(candidate, options);
      } catch {
        link = candidate;
      }
    }
    out.push(link);
  }
  return [...new Set(out)];
}

async function fetchDocument(url: string, options: RequestOptions = {}) {
  const response = await request(url, options);
  return {
    url: response.url,
    text: await response.text(),
  };
}

function normalizeShareUrl(url: string) {
  return url.split("?")[0] ?? url;
}

function decodeHtmlEntities(input: string) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeEmbeddedUrl(input: unknown) {
  const value = decodeHtmlEntities(String(input || ""))
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .trim();
  if (!value) return "";
  return value.startsWith("//") ? `https:${value}` : value;
}

function extractAwemeIdFromUrl(url: string) {
  const normalized = normalizeShareUrl(url);
  const match =
    /\/video\/(?<id>\d+)/.exec(normalized) ??
    /\/slides\/(?<id>\d+)/.exec(normalized) ??
    /\/note\/(?<id>\d+)/.exec(normalized) ??
    /\/share\/(?:video|note|slides)\/(?<id>\d+)/.exec(normalized) ??
    /[?&](?:aweme_id|item_id|modal_id)=(?<id>\d+)/.exec(url);
  return match?.groups?.id ?? "";
}

function extractAwemeIdFromHtml(html: string) {
  const patterns = [
    /"awemeId"\s*:\s*"(?<id>\d+)"/,
    /"aweme_id"\s*:\s*"?(?<id>\d+)"?/,
    /"itemId"\s*:\s*"(?<id>\d+)"/,
    /"item_id"\s*:\s*"?(?<id>\d+)"?/,
    /"group_id_str"\s*:\s*"(?<id>\d+)"/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.groups?.id) return match.groups.id;
  }
  return "";
}

function safeExtract(input: unknown, path: string, defaultValue: unknown): unknown {
  if (!path) return input ?? defaultValue;
  const segments = path.split(".");
  let current: unknown = input;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return defaultValue;
    const match = /^(?<key>[^\[]+)(?:\[(?<index>-?\d+)\])?$/.exec(segment);
    const key = match?.groups?.key;
    const indexRaw = match?.groups?.index;
    if (!key) return defaultValue;
    current = (current as Record<string, unknown>)[key];
    if (indexRaw != null) {
      const index = Number.parseInt(indexRaw, 10);
      current = Array.isArray(current)
        ? current.at(index)
        : Object.values((current as Record<string, unknown>) ?? {}).at(index);
    }
  }
  return current ?? defaultValue;
}

function extractPacePayloads(html: string) {
  const payloads: string[] = [];
  for (const match of html.matchAll(PACE_PAYLOAD_REGEX)) {
    try {
      let payload = JSON.parse(match[1]) as string;
      if (/^%[0-9A-Fa-f]{2}/.test(payload)) {
        payload = decodeURIComponent(payload);
      }
      payloads.push(payload);
    } catch {
      // ignore malformed chunks
    }
  }
  return payloads;
}

function extractRoutePayloadFromText(text: string) {
  const directPayload = extractAssignedValueFromHtml(text, [
    ["window", "_ROUTER_DATA"],
    ["_ROUTER_DATA"],
  ]);
  if (directPayload !== undefined && directPayload !== null) {
    return directPayload;
  }

  const trimmed = text.trim();
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.includes("videoInfoRes")) {
    const evaluated = extractExpressionValueFromText(trimmed);
    if (evaluated) return evaluated;
  }
  return null;
}

function extractRoutePayloadFromHtml(html: string) {
  const directPayload = extractRoutePayloadFromText(html);
  if (directPayload !== null) return directPayload;
  for (const payload of extractPacePayloads(html)) {
    const decodedPayload = extractRoutePayloadFromText(payload);
    if (decodedPayload !== null) return decodedPayload;
  }
  return null;
}

function hasArrayValue(input: unknown) {
  return Array.isArray(input) && input.length > 0;
}

function isVideoInfoResRecord(input: Record<string, unknown>) {
  return (
    hasArrayValue(safeExtract(input, "item_list", [])) ||
    hasArrayValue(safeExtract(input, "aweme_list", []))
  );
}

function findVideoInfoRes(payload: unknown): Record<string, unknown> {
  const stack: unknown[] = [payload];
  const seen = new Set<object>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || typeof current !== "object") continue;
    const objectCurrent = current as object;
    if (seen.has(objectCurrent)) continue;
    seen.add(objectCurrent);

    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push(current[index]);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    const nestedVideoInfoRes = safeExtract(record, "videoInfoRes", null);
    if (nestedVideoInfoRes && typeof nestedVideoInfoRes === "object") {
      return nestedVideoInfoRes as Record<string, unknown>;
    }
    if (isVideoInfoResRecord(record)) {
      return record;
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return {};
}

function extractRouteAwemeFromHtml(html: string) {
  const payload = extractRoutePayloadFromHtml(html);
  if (!payload) return {};
  const videoInfoRes = findVideoInfoRes(payload);
  const item =
    safeExtract(videoInfoRes, "item_list[0]", null) ??
    safeExtract(videoInfoRes, "aweme_list[0]", null);
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

function normalizeVideoUrl(url: string) {
  if (!url) return "";
  return String(url)
    .replace("playwm", "play")
    .replace(/([?&])ratio=[^&#]*/gi, "$1")
    .replace(/\?&/g, "?")
    .replace(/&&+/g, "&")
    .replace(/[?&]$/, "");
}

function parseSize(sizeRaw: unknown) {
  const size = Number(sizeRaw);
  return Number.isFinite(size) ? size : 0;
}

function parseDimension(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function collectUrlList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => decodeEmbeddedUrl(item))
    .filter((item) => /^https?:\/\//i.test(item));
}

function pickBestVideoUrl(
  aweme: Record<string, unknown>,
  preference: DouyinVideoPreference,
) {
  const bitRateRaw = safeExtract(aweme, "video.bit_rate", []);
  const bitRateList = Array.isArray(bitRateRaw)
    ? (bitRateRaw as Array<Record<string, unknown>>)
    : [];

  if (bitRateList.length > 0) {
    bitRateList.sort((left, right) => {
      const leftPlayAddr =
        left.play_addr && typeof left.play_addr === "object"
          ? (left.play_addr as Record<string, unknown>)
          : {};
      const rightPlayAddr =
        right.play_addr && typeof right.play_addr === "object"
          ? (right.play_addr as Record<string, unknown>)
          : {};
      switch (preference) {
        case "bitrate":
          return Number(left.bit_rate ?? 0) - Number(right.bit_rate ?? 0);
        case "size":
          return parseSize(leftPlayAddr.data_size) - parseSize(rightPlayAddr.data_size);
        case "resolution":
        default:
          return Number(leftPlayAddr.height ?? 0) - Number(rightPlayAddr.height ?? 0);
      }
    });
    const target = bitRateList.at(-1);
    const targetList = safeExtract(target, "play_addr.url_list", []);
    if (Array.isArray(targetList) && targetList.length > 0) {
      return normalizeVideoUrl(String(targetList[0]));
    }
  }

  const playListRaw = safeExtract(aweme, "video.play_addr.url_list", []);
  const playList = collectUrlList(playListRaw);
  return playList[0] ? normalizeVideoUrl(playList[0]) : "";
}

function pushImageItems(target: Array<Record<string, unknown>>, input: unknown) {
  if (!Array.isArray(input)) return;
  for (const item of input) {
    if (item && typeof item === "object") {
      target.push(item as Record<string, unknown>);
    }
  }
}

function collectImageItems(aweme: Record<string, unknown>) {
  const items: Array<Record<string, unknown>> = [];
  pushImageItems(items, safeExtract(aweme, "images", []));
  pushImageItems(items, safeExtract(aweme, "image_post_info.images", []));

  const imageBitrateRaw = safeExtract(aweme, "img_bitrate", []);
  if (Array.isArray(imageBitrateRaw)) {
    for (const gear of imageBitrateRaw) {
      pushImageItems(items, safeExtract(gear, "images", []));
    }
  }

  return items;
}

function pickImageUrl(item: Record<string, unknown>) {
  const fromUrlList = collectUrlList(safeExtract(item, "url_list", []));
  if (fromUrlList.length > 0) return fromUrlList[0];

  const fromDisplay = collectUrlList(safeExtract(item, "display_image.url_list", []));
  if (fromDisplay.length > 0) return fromDisplay[0];

  return "";
}

function extractImageLinks(aweme: Record<string, unknown>) {
  const bestByKey = new Map<string, ImageCandidate>();
  let order = 0;

  for (const item of collectImageItems(aweme)) {
    const url = pickImageUrl(item);
    if (!url) continue;

    const key = String(safeExtract(item, "uri", "") ?? "").trim() || url.split("?")[0];
    const area =
      parseDimension(safeExtract(item, "width", 0)) *
      parseDimension(safeExtract(item, "height", 0));

    const current = bestByKey.get(key);
    const position = current?.position ?? order;
    if (!current) {
      order += 1;
    }
    if (!current || area > current.area) {
      bestByKey.set(key, { url, area, position });
    }
  }

  return [...bestByKey.values()]
    .sort((left, right) => left.position - right.position)
    .map((item) => item.url);
}

function classifyWork(aweme: Record<string, unknown>): DouyinDetailData["type"] {
  const images = extractImageLinks(aweme);
  if (images.length > 1) return "图集";
  if (images.length === 1) return "图文";
  const awemeType = Number(safeExtract(aweme, "aweme_type", -1));
  if ([2, 4].includes(awemeType)) return "视频";
  return "未知";
}

function extractDetailData(
  aweme: Record<string, unknown>,
  sourceUrl: string,
  videoPreference: DouyinVideoPreference,
): DouyinDetailData | null {
  if (!aweme || Object.keys(aweme).length === 0) return null;
  const awemeId = String(safeExtract(aweme, "aweme_id", "") ?? "");
  if (!awemeId) return null;

  const tagsRaw = safeExtract(aweme, "text_extra", []);
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : [])
    .map((item) => String(safeExtract(item, "hashtag_name", "") ?? ""))
    .filter(Boolean);

  const type = classifyWork(aweme);
  const authorSecId = String(safeExtract(aweme, "author.sec_uid", "") ?? "");
  const authorUid = String(safeExtract(aweme, "author.uid", "") ?? "");
  const authorShortId = String(safeExtract(aweme, "author.short_id", "") ?? "");
  const desc =
    String(safeExtract(aweme, "desc", "") ?? "") ||
    String(safeExtract(aweme, "share_info.share_desc", "") ?? "");

  const detail: DouyinDetailData = {
    id: awemeId,
    url: sourceUrl,
    title: desc,
    desc,
    type,
    authorName: String(safeExtract(aweme, "author.nickname", "") ?? ""),
    authorId: authorUid || authorShortId,
    authorUrl: authorSecId
      ? `https://www.douyin.com/user/${authorSecId}`
      : authorUid
        ? `https://www.douyin.com/user/${authorUid}`
        : "",
    likedCount: Number(safeExtract(aweme, "statistics.digg_count", -1)),
    collectedCount: Number(safeExtract(aweme, "statistics.collect_count", -1)),
    commentCount: Number(safeExtract(aweme, "statistics.comment_count", -1)),
    shareCount: Number(safeExtract(aweme, "statistics.share_count", -1)),
    tags,
    downloadUrls: [],
    liveUrls: [],
  };

  if (type === "视频") {
    const best = pickBestVideoUrl(aweme, videoPreference);
    detail.downloadUrls = best ? [best] : [];
    detail.liveUrls = [null];
  } else if (type === "图文" || type === "图集") {
    const images = extractImageLinks(aweme);
    detail.downloadUrls = images;
    detail.liveUrls = images.map(() => null);
  }

  return detail;
}

function normalizeIndexList(index?: number[]) {
  if (!Array.isArray(index) || index.length === 0) return null;
  const indexes = index
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  return indexes.length ? indexes : null;
}

function buildDocumentCandidateUrls(originalUrl: string, awemeId: string) {
  const urls = [normalizeWebUrl(originalUrl)];
  if (awemeId) {
    urls.push(
      `https://m.douyin.com/video/${awemeId}`,
      `https://m.douyin.com/slides/${awemeId}`,
      `https://m.douyin.com/note/${awemeId}`,
      `https://m.douyin.com/share/video/${awemeId}`,
      `https://m.douyin.com/share/slides/${awemeId}`,
      `https://m.douyin.com/share/note/${awemeId}`,
    );
  }
  return [...new Set(urls)];
}

function resolveCookie(value?: string) {
  const direct = String(value ?? "").trim();
  if (direct) return direct;
  const fromEnv = String(process.env.DOUYIN_COOKIE ?? "").trim();
  return fromEnv || undefined;
}

export const DOUYIN_VIDEO_PREFERENCES = ["resolution", "bitrate", "size"] as const;

export async function getDouyinDetail(
  params: DouyinDetailParams,
): Promise<DouyinDetailResult> {
  const cookie = resolveCookie(params.cookie);
  const links = await extractLinks(params.url, {
    cookie,
    userAgent: MOBILE_UA,
  });
  if (links.length === 0) {
    return { message: "提取链接失败", params, data: null };
  }

  const originalUrl = links[0];
  let awemeId = extractAwemeIdFromUrl(originalUrl);
  const queue = [...buildDocumentCandidateUrls(originalUrl, awemeId)];
  const visited = new Set<string>();
  let document: Awaited<ReturnType<typeof fetchDocument>> | null = null;
  let matchedDocument: Awaited<ReturnType<typeof fetchDocument>> | null = null;
  let routeAweme: Record<string, unknown> = {};

  console.info("[douyin/detail] resolved", {
    originalUrl,
    awemeId,
    candidateUrls: queue,
  });

  while (queue.length > 0) {
    const candidateUrl = normalizeWebUrl(queue.shift() || "");
    if (!candidateUrl || visited.has(candidateUrl)) continue;
    visited.add(candidateUrl);

    const currentDocument = await fetchDocument(candidateUrl, {
      cookie,
      userAgent: MOBILE_UA,
    }).catch(() => null);
    if (!currentDocument?.text?.trim()) continue;

    if (!document) {
      document = currentDocument;
    }

    const currentAwemeId =
      extractAwemeIdFromUrl(currentDocument.url) || extractAwemeIdFromHtml(currentDocument.text);
    if (currentAwemeId && currentAwemeId !== awemeId) {
      awemeId = currentAwemeId;
      for (const nextUrl of buildDocumentCandidateUrls(originalUrl, awemeId)) {
        if (!visited.has(nextUrl)) {
          queue.push(nextUrl);
        }
      }
    }

    const currentRouteAweme = extractRouteAwemeFromHtml(currentDocument.text);
    if (Object.keys(currentRouteAweme).length > 0) {
      matchedDocument = currentDocument;
      routeAweme = currentRouteAweme;
      break;
    }
  }

  const attemptedUrls = [...visited];

  if (!document?.text?.trim()) {
    console.warn("[douyin/detail] fetch-document-failed", {
      originalUrl,
      awemeId,
      attemptedUrls,
    });
    return { message: "获取原始页面失败", params, data: null };
  }

  if (!matchedDocument || Object.keys(routeAweme).length === 0) {
    console.warn("[douyin/detail] route-data-missing", {
      originalUrl,
      firstDocumentUrl: document.url,
      awemeId,
      attemptedUrls,
    });
    return { message: "解析window._ROUTER_DATA失败", params, data: null };
  }

  const sourceUrl = matchedDocument.url || document.url || originalUrl;
  awemeId =
    String(safeExtract(routeAweme, "aweme_id", "") ?? "") ||
    awemeId ||
    extractAwemeIdFromUrl(sourceUrl) ||
    extractAwemeIdFromHtml(matchedDocument.text);
  if (!awemeId) {
    console.warn("[douyin/detail] aweme-id-missing", {
      originalUrl,
      sourceUrl,
      attemptedUrls,
    });
    return { message: "解析作品ID失败", params, data: null };
  }

  let detail = extractDetailData(
    routeAweme,
    sourceUrl,
    params.videoPreference ?? "resolution",
  );
  if (!detail || detail.downloadUrls.length === 0) {
    console.warn("[douyin/detail] media-missing", {
      originalUrl,
      sourceUrl,
      awemeId,
      attemptedUrls,
    });
    return { message: "解析videoInfoRes失败", params, data: null };
  }

  const normalized = normalizeIndexList(params.index);
  if (normalized) {
    const currentDetail = detail;
    detail = {
      ...currentDetail,
      downloadUrls: normalized
        .map((index) => currentDetail.downloadUrls[index - 1])
        .filter(Boolean),
      liveUrls: normalized.map((index) => currentDetail.liveUrls[index - 1] ?? null),
    };
  }

  console.info("[douyin/detail] success", {
    originalUrl,
    sourceUrl,
    awemeId,
    attemptedUrls,
    type: detail.type,
    mediaCount: detail.downloadUrls.length,
  });

  return {
    message: "success",
    params,
    data: detail,
  };
}
