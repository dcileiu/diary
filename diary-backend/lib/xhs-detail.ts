import vm from "node:vm";

const LINK_REGEX =
  /(?:https?:\/\/)?www\.xiaohongshu\.com\/explore\/[^\s"'<>\\^`{|}，。；！？、【】《》]+/gi;
const SHARE_REGEX =
  /(?:https?:\/\/)?www\.xiaohongshu\.com\/discovery\/item\/[^\s"'<>\\^`{|}，。；！？、【】《》]+/gi;
const PROFILE_REGEX =
  /(?:https?:\/\/)?www\.xiaohongshu\.com\/user\/profile\/[^\s"'<>\\^`{|}，。；！？、【】《》]+/gi;
const SHORT_REGEX =
  /(?:https?:\/\/)?xhslink\.com\/[^\s"'<>\\^`{|}，。；！？、【】《》]+/gi;
const SCRIPT_REGEX = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

const PHONE_KEYS_LINK = ["noteData", "data", "noteData"] as const;
const PC_KEYS_LINK = ["note", "noteDetailMap", "[-1]", "note"] as const;
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

export type XhsImageFormat =
  | "auto"
  | "png"
  | "webp"
  | "jpeg"
  | "heic"
  | "avif";
export type XhsVideoPreference = "resolution" | "bitrate" | "size";

export type XhsDetailParams = {
  url: string;
  imageFormat?: XhsImageFormat;
  videoPreference?: XhsVideoPreference;
  cookie?: string;
  index?: number[];
};

export type XhsDetailData = {
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

export type XhsDetailResult = {
  message: "success" | "failed" | string;
  params: XhsDetailParams;
  data: XhsDetailData | null;
};

type RequestOptions = {
  cookie?: string;
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
    host !== "xhslink.com" &&
    host !== "www.xiaohongshu.com" &&
    host !== "xiaohongshu.com"
  ) {
    throw new Error("不支持的链接域名");
  }
}

function extractCandidateLinks(text: string): string[] {
  if (!text?.trim()) return [];
  const matches = [
    ...Array.from(text.matchAll(SHORT_REGEX), (m) => normalizeWebUrl(m[0])),
    ...Array.from(text.matchAll(SHARE_REGEX), (m) => normalizeWebUrl(m[0])),
    ...Array.from(text.matchAll(LINK_REGEX), (m) => normalizeWebUrl(m[0])),
    ...Array.from(text.matchAll(PROFILE_REGEX), (m) => normalizeWebUrl(m[0])),
  ];
  return [...new Set(matches)];
}

async function request(url: string, options: RequestOptions = {}) {
  const normalized = normalizeWebUrl(url);
  ensureAllowedHost(normalized);
  const response = await fetch(normalized, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      referer: "https://www.xiaohongshu.com/explore",
      "user-agent": DEFAULT_UA,
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
    if (/xhslink\.com/i.test(candidate)) {
      try {
        link = await resolveUrl(candidate, options);
      } catch {
        // Fall back to the original short link so later fetch() can still follow redirects.
        link = candidate;
      }
    }
    out.push(link);
  }
  return [...new Set(out)];
}

async function fetchText(url: string, options: RequestOptions = {}) {
  const response = await request(url, options);
  return response.text();
}

function extractInitialStateScript(html: string): string {
  if (!html) return "";
  let matchedScript = "";
  let match: RegExpExecArray | null;
  while ((match = SCRIPT_REGEX.exec(html)) !== null) {
    const script = match[1]?.trim() ?? "";
    if (script.startsWith("window.__INITIAL_STATE__")) {
      matchedScript = script;
    }
  }
  return matchedScript;
}

function evaluateInitialState(script: string): Record<string, unknown> {
  if (!script) return {};
  const cleaned = script
    .replace(/^window\.__INITIAL_STATE__\s*=\s*/, "")
    .replace(/;+\s*$/, "")
    .trim();
  if (!cleaned || (!cleaned.startsWith("{") && !cleaned.startsWith("["))) {
    return {};
  }
  try {
    const result = vm.runInNewContext(
      `(${cleaned})`,
      Object.create(null) as object,
      {
        timeout: 1000,
      },
    );
    return result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function deepGet(
  input: unknown,
  keys: readonly string[],
  defaultValue: unknown = undefined,
) {
  let current: unknown = input;
  for (const key of keys) {
    if (current == null) return defaultValue;
    if (/^\[-?\d+\]$/.test(key)) {
      const index = Number.parseInt(key.slice(1, -1), 10);
      current = Array.isArray(current)
        ? current.at(index)
        : Object.values(current as Record<string, unknown>).at(index);
      continue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? defaultValue;
}

function filterNoteData(payload: Record<string, unknown>) {
  const phone = deepGet(payload, PHONE_KEYS_LINK, null);
  if (phone && typeof phone === "object")
    return phone as Record<string, unknown>;

  const pc = deepGet(payload, PC_KEYS_LINK, null);
  if (pc && typeof pc === "object") return pc as Record<string, unknown>;

  return {};
}

function parseNoteDataFromHtml(html: string) {
  const script = extractInitialStateScript(html);
  const payload = evaluateInitialState(script);
  return filterNoteData(payload);
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

function decodeEscapedUrl(url: string) {
  return url
    .replace(/\\u([\da-fA-F]{4})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\x([\da-fA-F]{2})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\\//g, "/");
}

function classifyWork(noteData: Record<string, unknown>): XhsDetailData["type"] {
  const type = String(safeExtract(noteData, "type", "") ?? "");
  const imageListRaw = safeExtract(noteData, "imageList", []);
  const imageList = Array.isArray(imageListRaw) ? imageListRaw : [];
  if (!["video", "normal"].includes(type) || imageList.length === 0) {
    return "未知";
  }
  if (type === "video") {
    return imageList.length === 1 ? "视频" : "图集";
  }
  return "图文";
}

function extractImageToken(url: string) {
  if (!url) return "";
  const raw = url.split("!")[0] ?? "";
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.join("/");
  } catch {
    return raw.replace(/^https?:\/\/[^/]+\//, "");
  }
}

function buildImageUrl(token: string, imageFormat: XhsImageFormat) {
  if (imageFormat === "auto") {
    return `https://sns-img-bd.xhscdn.com/${token}`;
  }
  return `https://ci.xiaohongshu.com/${token}?imageView2/format/${imageFormat}`;
}

function stripShareTokenParams(url: string) {
  return url
    .replace(/([?&])xsec_token=[^&#]*/gi, "$1")
    .replace(/([?&])xsec_source=[^&#]*/gi, "$1")
    .replace(/\?&/g, "?")
    .replace(/&&+/g, "&")
    .replace(/[?&]($|#)/, "$1");
}

function cleanDownloadUrl(url: string) {
  const decoded = decodeEscapedUrl(url);
  return stripShareTokenParams(decoded);
}

function extractImageLinks(noteData: Record<string, unknown>, imageFormat: XhsImageFormat) {
  const imageListRaw = safeExtract(noteData, "imageList", []);
  const imageList = Array.isArray(imageListRaw) ? imageListRaw : [];
  const tokens = imageList
    .map((item) => {
      const value = safeExtract(item, "urlDefault", "");
      return extractImageToken(String(value ?? ""));
    })
    .filter(Boolean);
  return {
    downloadUrls: tokens.map((token) => cleanDownloadUrl(buildImageUrl(token, imageFormat))),
    liveUrls: imageList.map((item) => {
      const value = safeExtract(item, "stream.h264[0].masterUrl", "");
      return value ? decodeEscapedUrl(String(value)) : null;
    }),
  };
}

function extractVideoLinks(
  noteData: Record<string, unknown>,
  preference: XhsVideoPreference = "resolution",
) {
  const originVideoKey = String(
    safeExtract(noteData, "video.consumer.originVideoKey", "") ?? "",
  );
  if (originVideoKey) {
    return [decodeEscapedUrl(`https://sns-video-bd.xhscdn.com/${originVideoKey}`)];
  }

  const h264Raw = safeExtract(noteData, "video.media.stream.h264", []);
  const h265Raw = safeExtract(noteData, "video.media.stream.h265", []);
  const h264 = Array.isArray(h264Raw) ? h264Raw : [];
  const h265 = Array.isArray(h265Raw) ? h265Raw : [];
  const items = [...h264, ...h265] as Array<Record<string, unknown>>;
  if (items.length === 0) return [];

  items.sort((left, right) => {
    switch (preference) {
      case "bitrate":
        return Number(left.videoBitrate ?? 0) - Number(right.videoBitrate ?? 0);
      case "size":
        return Number(left.size ?? 0) - Number(right.size ?? 0);
      case "resolution":
      default:
        return Number(left.height ?? 0) - Number(right.height ?? 0);
    }
  });

  const target = items.at(-1);
  const backupUrls = Array.isArray(target?.backupUrls) ? target?.backupUrls : [];
  const backupUrl = backupUrls[0];
  const masterUrl = target?.masterUrl;
  const picked = decodeEscapedUrl(String(backupUrl ?? masterUrl ?? ""));
  return picked ? [picked] : [];
}

function extractDetailData(
  noteData: Record<string, unknown>,
  sourceUrl: string,
  imageFormat: XhsImageFormat,
  videoPreference: XhsVideoPreference,
): XhsDetailData | null {
  if (!noteData || Object.keys(noteData).length === 0) return null;
  const noteId = String(safeExtract(noteData, "noteId", "") ?? "");
  if (!noteId) return null;

  const type = classifyWork(noteData);
  const tagsRaw = safeExtract(noteData, "tagList", []);
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : [])
    .map((item) => String(safeExtract(item, "name", "") ?? ""))
    .filter(Boolean);

  const authorName =
    String(safeExtract(noteData, "user.nickname", "") ?? "") ||
    String(safeExtract(noteData, "user.nickName", "") ?? "");
  const authorId = String(safeExtract(noteData, "user.userId", "") ?? "");

  const detail: XhsDetailData = {
    id: noteId,
    url: sourceUrl || `https://www.xiaohongshu.com/explore/${noteId}`,
    title: String(safeExtract(noteData, "title", "") ?? ""),
    desc: String(safeExtract(noteData, "desc", "") ?? ""),
    type,
    authorName,
    authorId,
    authorUrl: authorId
      ? `https://www.xiaohongshu.com/user/profile/${authorId}`
      : "",
    likedCount: Number(safeExtract(noteData, "interactInfo.likedCount", -1)),
    collectedCount: Number(safeExtract(noteData, "interactInfo.collectedCount", -1)),
    commentCount: Number(safeExtract(noteData, "interactInfo.commentCount", -1)),
    shareCount: Number(safeExtract(noteData, "interactInfo.shareCount", -1)),
    tags,
    downloadUrls: [],
    liveUrls: [],
  };

  if (type === "视频") {
    detail.downloadUrls = extractVideoLinks(noteData, videoPreference);
    detail.liveUrls = [null];
  } else if (type === "图文" || type === "图集") {
    const media = extractImageLinks(noteData, imageFormat);
    detail.downloadUrls = media.downloadUrls;
    detail.liveUrls = media.liveUrls;
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

export const XHS_IMAGE_FORMATS = ["auto", "png", "webp", "jpeg", "heic", "avif"] as const;
export const XHS_VIDEO_PREFERENCES = ["resolution", "bitrate", "size"] as const;

export async function getXhsDetail(params: XhsDetailParams): Promise<XhsDetailResult> {
  const links = await extractLinks(params.url, { cookie: params.cookie });
  if (links.length === 0) {
    return { message: "提取链接失败", params, data: null };
  }

  const html = await fetchText(links[0], { cookie: params.cookie });
  const noteData = parseNoteDataFromHtml(html);
  let detail = extractDetailData(
    noteData,
    links[0],
    params.imageFormat ?? "jpeg",
    params.videoPreference ?? "resolution",
  );

  const normalized = normalizeIndexList(params.index);
  if (detail && normalized) {
    const currentDetail = detail;
    detail = {
      ...currentDetail,
      downloadUrls: normalized
        .map((index) => currentDetail.downloadUrls[index - 1])
        .filter(Boolean),
      liveUrls: normalized.map((index) => currentDetail.liveUrls[index - 1] ?? null),
    };
  }

  return {
    message: detail ? "success" : "failed",
    params,
    data: detail,
  };
}
