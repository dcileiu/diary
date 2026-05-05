import {
  extractAssignedValueFromHtml,
  type ScriptEvalOptions,
} from "@/lib/script-data-extractor";

const WECHAT_URL_REGEX = /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[^\s"'<>\\^`{|}]+/gi;
const WECHAT_REFERER = "https://mp.weixin.qq.com/";
const DEFAULT_WECHAT_COOKIE = "rewardsn=; wxtokenkey=777";
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

export type WechatArticleDetailParams = {
  url: string;
  cookie?: string;
  index?: number[];
};

export type WechatArticleDetailData = {
  id: string;
  url: string;
  title: string;
  desc: string;
  type: "图文" | "图集" | "视频" | "未知";
  accountName: string;
  author: string;
  publishTime: string;
  coverImage: string;
  contentText: string;
  contentHtml: string;
  downloadUrls: string[];
  liveUrls: Array<string | null>;
};

export type WechatArticleDetailResult = {
  message: "success" | "failed" | string;
  params: WechatArticleDetailParams;
  data: WechatArticleDetailData | null;
};

type RequestOptions = {
  cookie?: string;
};

type WechatScriptPayload = {
  cgiData: Record<string, unknown> | null;
  picturePageInfoList: Array<Record<string, unknown>>;
};

const SCRIPT_EVAL_OPTIONS: ScriptEvalOptions = {
  functions: {
    JsDecode(value: unknown) {
      return String(value ?? "")
        .replace(/\\x5c/gi, "\\")
        .replace(/\\x0d/gi, "\r")
        .replace(/\\x0a/gi, "\n")
        .replace(/\\x22/gi, '"')
        .replace(/\\x27/gi, "'")
        .replace(/\\x26/gi, "&")
        .replace(/\\x3c/gi, "<")
        .replace(/\\x3e/gi, ">");
    },
  },
};

function normalizeWebUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

function ensureAllowedHost(raw: string) {
  const u = new URL(raw);
  if (u.hostname.toLowerCase() !== "mp.weixin.qq.com") {
    throw new Error("不支持的微信公众号链接");
  }
}

function extractCandidateLinks(text: string): string[] {
  if (!text?.trim()) return [];
  return [
    ...new Set(
      Array.from(text.matchAll(WECHAT_URL_REGEX), (match) => normalizeWebUrl(match[0])),
    ),
  ];
}

async function request(url: string, options: RequestOptions = {}) {
  const normalized = normalizeWebUrl(url);
  ensureAllowedHost(normalized);
  const response = await fetch(normalized, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      referer: WECHAT_REFERER,
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
    try {
      out.push(await resolveUrl(candidate, options));
    } catch {
      out.push(candidate);
    }
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

function decodeHtmlEntities(input: string) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function decodeEmbeddedUrl(input: unknown) {
  return decodeHtmlEntities(String(input || ""))
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .trim();
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractElementInnerHtmlById(html: string, tagName: string, id: string) {
  const openPattern = new RegExp(
    `<${tagName}\\b[^>]*\\bid=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const openMatch = openPattern.exec(html);
  if (!openMatch) return "";

  const start = openMatch.index + openMatch[0].length;
  const tokenPattern = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}>`, "gi");
  tokenPattern.lastIndex = start;
  let depth = 1;
  let token: RegExpExecArray | null;

  while ((token = tokenPattern.exec(html)) !== null) {
    if (/^<\//i.test(token[0])) {
      depth -= 1;
    } else if (!/\/>$/.test(token[0])) {
      depth += 1;
    }
    if (depth === 0) {
      return html.slice(start, token.index);
    }
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

function pushUnique(list: string[], value: string) {
  const normalized = decodeEmbeddedUrl(value);
  if (!/^https?:\/\//i.test(normalized)) return;
  if (!list.includes(normalized)) {
    list.push(normalized);
  }
}

function normalizePictureItems(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item),
  );
}

function extractPicturePageInfoList(payload: WechatScriptPayload) {
  return [
    ...normalizePictureItems(safeExtract(payload.cgiData, "picture_page_info_list", [])),
    ...normalizePictureItems(payload.picturePageInfoList),
  ];
}

function pickPictureUrl(item: Record<string, unknown>) {
  const cdnUrl = decodeEmbeddedUrl(safeExtract(item, "cdn_url", ""));
  if (/^https?:\/\//i.test(cdnUrl)) {
    return cdnUrl;
  }
  const originalUrl = decodeEmbeddedUrl(safeExtract(item, "original_info.cdn_url", ""));
  return /^https?:\/\//i.test(originalUrl) ? originalUrl : "";
}

function extractPictureUrls(payload: WechatScriptPayload) {
  const urls: string[] = [];
  for (const item of extractPicturePageInfoList(payload)) {
    pushUnique(urls, pickPictureUrl(item));
  }
  return urls;
}

function normalizePublishTime(primary: unknown, fallback: unknown) {
  const primaryText = String(primary ?? "").trim();
  if (primaryText) return primaryText;
  const raw = String(fallback ?? "").trim();
  if (!raw) return "";
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
  return raw;
}

function normalizeIndexList(index?: number[]) {
  if (!Array.isArray(index) || index.length === 0) return null;
  const indexes = index
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  return indexes.length > 0 ? indexes : null;
}

function resolveCookie(value?: string) {
  const direct = String(value ?? "").trim();
  if (direct) return direct;
  const fromEnv = String(process.env.WECHAT_COOKIE ?? "").trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_WECHAT_COOKIE;
}

function extractWechatPayload(html: string): WechatScriptPayload {
  const cgiData = extractAssignedValueFromHtml(
    html,
    [
      ["window", "cgiDataNew"],
      ["cgiDataNew"],
    ],
    SCRIPT_EVAL_OPTIONS,
  );
  const picturePageInfoList = extractAssignedValueFromHtml(
    html,
    [
      ["window", "picture_page_info_list"],
      ["picture_page_info_list"],
    ],
    SCRIPT_EVAL_OPTIONS,
  );

  return {
    cgiData:
      cgiData && typeof cgiData === "object" && !Array.isArray(cgiData)
        ? (cgiData as Record<string, unknown>)
        : null,
    picturePageInfoList: normalizePictureItems(picturePageInfoList),
  };
}

export function extractWechatArticleDetailFromHtml(
  html: string,
  sourceUrl: string,
): WechatArticleDetailData | null {
  const payload = extractWechatPayload(html);
  if (!payload.cgiData) {
    return null;
  }

  const contentHtml = extractElementInnerHtmlById(html, "div", "js_content");
  const downloadUrls = extractPictureUrls(payload);
  const coverImage =
    decodeEmbeddedUrl(safeExtract(payload.cgiData, "cdn_url", "")) ||
    downloadUrls[0] ||
    "";
  const type: WechatArticleDetailData["type"] =
    downloadUrls.length > 1 ? "图集" : downloadUrls.length === 1 ? "图文" : "未知";

  const descRaw =
    String(safeExtract(payload.cgiData, "desc", "") ?? "") ||
    String(safeExtract(payload.cgiData, "content_noencode", "") ?? "");
  const title = String(safeExtract(payload.cgiData, "title", "") ?? "").trim();

  return {
    id:
      String(safeExtract(payload.cgiData, "mid", "") ?? "") ||
      String(safeExtract(payload.cgiData, "comment_id", "") ?? "") ||
      sourceUrl,
    url: sourceUrl,
    title,
    desc: stripHtml(descRaw || title),
    type,
    accountName:
      String(safeExtract(payload.cgiData, "nick_name", "") ?? "") ||
      String(safeExtract(payload.cgiData, "user_name", "") ?? ""),
    author: String(safeExtract(payload.cgiData, "author", "") ?? ""),
    publishTime: normalizePublishTime(
      safeExtract(payload.cgiData, "create_time", ""),
      safeExtract(payload.cgiData, "ori_create_time", ""),
    ),
    coverImage,
    contentText: stripHtml(
      contentHtml || String(safeExtract(payload.cgiData, "content_noencode", "") ?? ""),
    ),
    contentHtml,
    downloadUrls,
    liveUrls: downloadUrls.map(() => null),
  };
}

export async function getWechatArticleDetail(
  params: WechatArticleDetailParams,
): Promise<WechatArticleDetailResult> {
  const cookie = resolveCookie(params.cookie);
  const links = await extractLinks(params.url, { cookie });
  if (links.length === 0) {
    return { message: "提取链接失败", params, data: null };
  }

  const document = await fetchDocument(links[0], { cookie }).catch(() => null);
  if (!document?.text?.trim()) {
    return { message: "获取原始页面失败", params, data: null };
  }

  const payload = extractWechatPayload(document.text);
  if (!payload.cgiData) {
    return { message: "解析window.cgiDataNew失败", params, data: null };
  }

  let detail = extractWechatArticleDetailFromHtml(document.text, document.url);
  if (!detail) {
    return { message: "解析window.cgiDataNew失败", params, data: null };
  }
  if (detail.downloadUrls.length === 0) {
    return { message: "解析picture_page_info_list失败", params, data: null };
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

  return {
    message: "success",
    params,
    data: detail,
  };
}
