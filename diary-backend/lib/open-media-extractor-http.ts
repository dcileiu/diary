import {
  getDouyinDetail,
  type DouyinVideoPreference,
} from "@/lib/douyin-detail";
import { getWechatArticleDetail } from "@/lib/wechat-article-detail";
import {
  getXhsDetail,
  type XhsImageFormat,
  type XhsVideoPreference,
} from "@/lib/xhs-detail";

type PlatformId =
  | "wechat"
  | "douyin"
  | "bilibili"
  | "xiaohongshu"
  | "kuaishou"
  | "generic";

type PlatformDefinition = {
  id: PlatformId;
  name: string;
  hosts: string[];
};

export type ExtractedImage = {
  url: string;
  alt?: string;
};

export type ExtractedVideo = {
  url: string;
  poster?: string;
  source?: string;
  referer?: string;
  quality?: string | number;
  codec?: string;
  audio_url?: string;
};

export type ExtractedMediaData = {
  url: string;
  source_url: string;
  share_text: string;
  fetched_at: string;
  platform: PlatformId;
  platform_name: string;
  title: string;
  account_name: string;
  author: string;
  publish_time: string;
  summary: string;
  content_text: string;
  content_html: string;
  cover_image: string;
  images: ExtractedImage[];
  videos: ExtractedVideo[];
};

export type ExtractOpenMediaOptions = {
  input: string;
  cookie?: string;
  imageFormat?: XhsImageFormat;
  videoPreference?: DouyinVideoPreference | XhsVideoPreference;
  index?: number[];
  waitMs?: number;
};

type ExtractorSource = {
  raw_input: string;
  url: string;
  share_text: string;
  platform: PlatformDefinition;
};

type FetchPageOptions = {
  cookie?: string;
  referer?: string;
};

const SOCIAL_PLATFORMS: PlatformDefinition[] = [
  { id: "wechat", name: "WeChat", hosts: ["mp.weixin.qq.com"] },
  { id: "douyin", name: "Douyin", hosts: ["douyin.com", "iesdouyin.com", "amemv.com"] },
  { id: "bilibili", name: "Bilibili", hosts: ["bilibili.com", "b23.tv"] },
  { id: "xiaohongshu", name: "Xiaohongshu", hosts: ["xiaohongshu.com", "xhslink.com", "xhs.cn"] },
  { id: "kuaishou", name: "Kuaishou", hosts: ["kuaishou.com", "gifshow.com"] },
];

const GENERIC_PLATFORM: PlatformDefinition = {
  id: "generic",
  name: "WebPage",
  hosts: [],
};

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const VIDEO_URL_PATTERN =
  /\.(mp4|m3u8|mov|webm|m4s|flv)(?:[?#]|$)|\/aweme\/v1\/play(?:wm)?\/|\/video\/tos\//i;
const IMAGE_URL_PATTERN = /\.(jpe?g|png|gif|webp|heic|heif)(?:[?#]|$)/i;
const DEFAULT_WECHAT_COOKIE = "rewardsn=; wxtokenkey=777";

export function extractFirstUrl(input: string) {
  const match = String(input || "").match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return "";
  return match[0].replace(/[),.;!?，。！？、】）]+$/u, "");
}

export function detectPlatform(url: string): PlatformDefinition {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return (
    SOCIAL_PLATFORMS.find((platform) =>
      platform.hosts.some(
        (platformHost) =>
          host === platformHost || host.endsWith(`.${platformHost}`),
      ),
    ) || GENERIC_PLATFORM
  );
}

export function normalizeExtractorInput(input: string): ExtractorSource {
  const rawInput = String(input || "").trim();
  const candidateUrl = extractFirstUrl(rawInput) || rawInput;
  try {
    const parsed = new URL(candidateUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      throw new Error("Only http and https URLs are supported.");
    }
    return {
      raw_input: rawInput,
      url: parsed.toString(),
      share_text: rawInput && rawInput !== parsed.toString() ? rawInput : "",
      platform: detectPlatform(parsed.toString()),
    };
  } catch {
    throw new Error(`Invalid article or media URL: ${input}`);
  }
}

function isTruthy(value: string | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function assertAllowedPublicPlatform(source: ExtractorSource) {
  if (source.platform.id !== "generic") return;
  if (isTruthy(process.env.OPEN_MEDIA_EXTRACT_ALLOW_GENERIC)) return;
  throw new Error(
    "Unsupported host for public extractor. Only WeChat, Douyin, Bilibili, Xiaohongshu, and Kuaishou are allowed.",
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function cleanEmbeddedUrl(value: string) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/[\\]+$/g, "")
    .replace(/[),.;!?，。！？、】）]+$/u, "");
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

function addUniqueMedia<T extends { url: string }>(
  list: T[],
  url: string,
  extra: Omit<T, "url">,
) {
  const normalizedUrl = normalizeHttpUrl(url);
  if (!normalizedUrl) return;
  if (list.some((item) => item.url === normalizedUrl)) return;
  list.push({ url: normalizedUrl, ...extra } as T);
}

function normalizeHttpUrl(url: string) {
  const value = cleanEmbeddedUrl(url);
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return /^https?:\/\//i.test(value) ? value : "";
}

function isLikelyVideoUrl(url: string) {
  return VIDEO_URL_PATTERN.test(url);
}

function isLikelyImageUrl(url: string) {
  return IMAGE_URL_PATTERN.test(url);
}

function collectMediaUrlsFromText(text: string, predicate: (url: string) => boolean) {
  const found: string[] = [];
  const patterns = [
    /https?:\/\/[^"'<>\\\s]+/gi,
    /https:(?:\\u002F|\\\/|\/){2}[^"'<>\s]+/gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(text || "").matchAll(pattern)) {
      const url = normalizeHttpUrl(match[0]);
      if (url && predicate(url) && !found.includes(url)) {
        found.push(url);
      }
    }
  }
  return found;
}

function collectAttributeUrls(html: string, tagName: string, attrs: string[]) {
  const urls: string[] = [];
  const attrPart = attrs.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*\\b(?:${attrPart})=["']([^"']+)["'][^>]*>`,
    "gi",
  );
  for (const match of html.matchAll(pattern)) {
    const url = normalizeHttpUrl(match[1] || "");
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

function extractMetaContent(html: string, key: string, attr: "name" | "property") {
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const match = pattern.exec(html);
  return decodeHtmlEntities(match?.[1] || "").trim();
}

function extractTitleTag(html: string) {
  const match = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return stripHtml(match?.[1] || "");
}

function extractScriptStringValue(html: string, names: string[]) {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `(?:var\\s+)?${escapeRegExp(name)}\\s*=\\s*htmlDecode\\((["'])([\\s\\S]*?)\\1\\)`,
        "i",
      ),
      new RegExp(
        `(?:var\\s+)?${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match?.[2]) {
        return decodeHtmlEntities(match[2]).trim();
      }
    }
  }
  return "";
}

function extractScriptNumberValue(html: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(
      `(?:var\\s+)?${escapeRegExp(name)}\\s*=\\s*(\\d{8,13})`,
      "i",
    );
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return "";
}

function toIsoTime(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
  return raw;
}

function extractElementInnerHtmlById(html: string, tagName: string, id: string) {
  const openPattern = new RegExp(
    `<${tagName}\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`,
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

function extractElementTextById(html: string, id: string) {
  const candidates = [
    extractElementInnerHtmlById(html, "div", id),
    extractElementInnerHtmlById(html, "span", id),
    extractElementInnerHtmlById(html, "h1", id),
    extractElementInnerHtmlById(html, "p", id),
  ];
  return stripHtml(candidates.find(Boolean) || "");
}

async function fetchTextPage(url: string, options: FetchPageOptions = {}) {
  const response = await fetch(url, {
    headers: {
      accept: HTML_ACCEPT,
      "user-agent": DESKTOP_USER_AGENT,
      ...(options.referer ? { referer: options.referer } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return {
    url: response.url,
    html: await response.text(),
  };
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": DESKTOP_USER_AGENT,
      ...headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function normalizeBilibiliImageUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function pickBilibiliDashVideo(
  playData: Record<string, unknown> | undefined,
  referer: string,
) {
  const dash = (playData?.dash || {}) as Record<string, unknown>;
  const videos = Array.isArray(dash.video)
    ? (dash.video as Array<Record<string, unknown>>)
    : [];
  const audios = Array.isArray(dash.audio)
    ? (dash.audio as Array<Record<string, unknown>>)
    : [];
  const bestVideo = videos
    .filter((item) => item?.baseUrl || item?.base_url)
    .sort((a, b) => Number(b.bandwidth || 0) - Number(a.bandwidth || 0))[0];
  if (!bestVideo) return null;
  const bestAudio = audios
    .filter((item) => item?.baseUrl || item?.base_url)
    .sort((a, b) => Number(b.bandwidth || 0) - Number(a.bandwidth || 0))[0];
  return {
    url: String(bestVideo.baseUrl || bestVideo.base_url || ""),
    source: "bilibili-dash-video",
    quality: String(bestVideo.id || ""),
    codec: String(bestVideo.codecs || ""),
    audio_url: String(bestAudio?.baseUrl || bestAudio?.base_url || ""),
    referer,
  } satisfies ExtractedVideo;
}

function extractBilibiliBvid(...values: string[]) {
  for (const value of values) {
    const match = String(value || "").match(/\b(BV[0-9A-Za-z]{8,})\b/);
    if (match) return match[1];
  }
  return "";
}

async function extractBilibiliData(source: ExtractorSource) {
  const bvid = extractBilibiliBvid(source.url, source.share_text, source.raw_input);
  if (!bvid) {
    throw new Error("Bilibili BV id not found.");
  }

  const pageUrl = `https://www.bilibili.com/video/${bvid}/`;
  const headers = {
    referer: pageUrl,
    origin: "https://www.bilibili.com",
  };
  const viewPayload = await fetchJson<{
    code: number;
    message?: string;
    data?: Record<string, unknown>;
  }>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    headers,
  );
  if (viewPayload.code !== 0 || !viewPayload.data) {
    throw new Error(`Bilibili view API failed: ${viewPayload.message || viewPayload.code}`);
  }

  const view = viewPayload.data;
  const pages = Array.isArray(view.pages)
    ? (view.pages as Array<Record<string, unknown>>)
    : [];
  const cid = Number(view.cid || 0) || Number(pages[0]?.cid || 0);
  if (!cid) {
    throw new Error("Bilibili cid not found.");
  }

  const mp4Payload = await fetchJson<{
    data?: {
      quality?: number;
      durl?: Array<{ url?: string }>;
    };
  }>(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(
      bvid,
    )}&cid=${encodeURIComponent(String(cid))}&qn=16&fnval=0&fourk=0`,
    headers,
  );
  const mp4Data = mp4Payload.data || {};
  const mp4Url = mp4Data.durl?.find((item) => item?.url)?.url || "";

  let dashVideo: ExtractedVideo | null = null;
  if (!mp4Url) {
    const dashPayload = await fetchJson<{ data?: Record<string, unknown> }>(
      `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(
        bvid,
      )}&cid=${encodeURIComponent(String(cid))}&qn=80&fnval=16&fourk=1`,
      headers,
    ).catch(() => null);
    dashVideo = pickBilibiliDashVideo(dashPayload?.data, pageUrl);
  }

  const owner = (view.owner || {}) as Record<string, unknown>;
  const cover = normalizeBilibiliImageUrl(String(view.pic || ""));
  const videos: ExtractedVideo[] = [];
  if (mp4Url) {
    videos.push({
      url: mp4Url,
      poster: cover,
      source: "bilibili-mp4",
      quality: mp4Data.quality || 16,
      referer: pageUrl,
    });
  } else if (dashVideo) {
    videos.push({ ...dashVideo, poster: cover });
  }

  return {
    url: pageUrl,
    source_url: source.url,
    share_text: source.share_text,
    fetched_at: new Date().toISOString(),
    platform: "bilibili" as const,
    platform_name: "Bilibili",
    title: String(view.title || bvid),
    account_name: String(owner.name || ""),
    author: String(owner.name || ""),
    publish_time: view.pubdate ? new Date(Number(view.pubdate) * 1000).toISOString() : "",
    summary: String(view.desc || ""),
    content_text: String(view.desc || view.title || ""),
    content_html: "",
    cover_image: cover,
    images: cover ? [{ url: cover, alt: "cover" }] : [],
    videos,
  } satisfies ExtractedMediaData;
}

function extractWeChatPictureBlock(html: string) {
  const match = html.match(
    /window\.picture_page_info_list\s*=\s*(\[[\s\S]*?\])(?:\.slice\(0,\s*\d+\))?/i,
  );
  return match?.[1] || "";
}

function extractWeChatImages(html: string) {
  const images: ExtractedImage[] = [];
  const pictureBlock = extractWeChatPictureBlock(html);
  for (const url of collectMediaUrlsFromText(
    pictureBlock || html,
    (value) => isLikelyImageUrl(value) || /mmbiz\.qpic\.cn|qpic\.cn/i.test(value),
  )) {
    addUniqueMedia(images, url, { alt: "" });
  }
  for (const url of collectAttributeUrls(html, "img", ["data-src", "src"])) {
    if (isLikelyImageUrl(url) || /mmbiz\.qpic\.cn|qpic\.cn/i.test(url)) {
      addUniqueMedia(images, url, { alt: "" });
    }
  }
  return images;
}

function extractWeChatVideos(html: string, referer: string) {
  const videos: ExtractedVideo[] = [];
  for (const url of [
    ...collectAttributeUrls(html, "video", ["src", "data-src"]),
    ...collectAttributeUrls(html, "source", ["src"]),
    ...collectAttributeUrls(html, "iframe", ["src"]),
    ...collectMediaUrlsFromText(
      html,
      (value) => isLikelyVideoUrl(value) || /mpvideo\.qpic\.cn|qqvideo\.tc\.qq\.com/i.test(value),
    ),
  ]) {
    if (isLikelyVideoUrl(url) || /mpvideo\.qpic\.cn|qqvideo\.tc\.qq\.com/i.test(url)) {
      addUniqueMedia(videos, url, { referer, source: "html" });
    }
  }
  return videos;
}

async function extractWeChatData(source: ExtractorSource, options: ExtractOpenMediaOptions) {
  const result = await getWechatArticleDetail({
    url: source.raw_input || source.url,
    cookie: options.cookie || DEFAULT_WECHAT_COOKIE,
    index: options.index,
  });
  if (!result.data) {
    throw new Error(result.message || "WeChat extract failed.");
  }

  const images = result.data.downloadUrls.map((url) => ({ url, alt: "" }));
  const videos: ExtractedVideo[] = [];
  for (const url of result.data.liveUrls) {
    if (!url) continue;
    videos.push({
      url,
      referer: result.data.url,
      source: "wechat-script",
    });
  }

  return {
    url: result.data.url || source.url,
    source_url: source.url,
    share_text: source.share_text,
    fetched_at: new Date().toISOString(),
    platform: "wechat" as const,
    platform_name: "WeChat",
    title: result.data.title || result.data.desc || "",
    account_name: result.data.accountName || "",
    author: result.data.author || result.data.accountName || "",
    publish_time: result.data.publishTime || "",
    summary: result.data.desc || "",
    content_text: result.data.contentText || result.data.desc || result.data.title || "",
    content_html: result.data.contentHtml || "",
    cover_image: result.data.coverImage || images[0]?.url || "",
    images,
    videos,
  } satisfies ExtractedMediaData;
}

async function extractSimpleHtmlMediaData(
  source: ExtractorSource,
  options: ExtractOpenMediaOptions,
) {
  const referer =
    source.platform.id === "kuaishou"
      ? "https://www.kuaishou.com/"
      : source.url;
  const page = await fetchTextPage(source.url, {
    cookie: options.cookie,
    referer,
  });
  const html = page.html;
  const images: ExtractedImage[] = [];
  const videos: ExtractedVideo[] = [];
  const coverImage =
    extractMetaContent(html, "og:image", "property") ||
    extractMetaContent(html, "twitter:image", "name");

  if (coverImage) {
    addUniqueMedia(images, coverImage, { alt: "cover" });
  }
  for (const url of collectAttributeUrls(html, "img", ["src", "data-src"])) {
    if (isLikelyImageUrl(url)) addUniqueMedia(images, url, { alt: "" });
  }
  for (const url of collectMediaUrlsFromText(html, isLikelyImageUrl).slice(0, 80)) {
    addUniqueMedia(images, url, { alt: "" });
  }

  const metaVideos = [
    extractMetaContent(html, "og:video", "property"),
    extractMetaContent(html, "og:video:url", "property"),
    extractMetaContent(html, "og:video:secure_url", "property"),
    extractMetaContent(html, "twitter:player:stream", "name"),
  ].filter(Boolean);
  for (const url of [
    ...metaVideos,
    ...collectAttributeUrls(html, "video", ["src"]),
    ...collectAttributeUrls(html, "source", ["src"]),
    ...collectAttributeUrls(html, "iframe", ["src"]),
    ...collectMediaUrlsFromText(html, isLikelyVideoUrl),
  ]) {
    if (isLikelyVideoUrl(url)) {
      addUniqueMedia(videos, url, { referer: page.url, source: "html" });
    }
  }

  return {
    url: page.url,
    source_url: source.url,
    share_text: source.share_text,
    fetched_at: new Date().toISOString(),
    platform: source.platform.id,
    platform_name: source.platform.name,
    title:
      extractMetaContent(html, "og:title", "property") ||
      extractMetaContent(html, "twitter:title", "name") ||
      extractTitleTag(html),
    account_name: extractMetaContent(html, "author", "name"),
    author: extractMetaContent(html, "author", "name"),
    publish_time:
      extractMetaContent(html, "article:published_time", "property") ||
      "",
    summary:
      extractMetaContent(html, "description", "name") ||
      extractMetaContent(html, "og:description", "property") ||
      extractMetaContent(html, "twitter:description", "name"),
    content_text: stripHtml(html),
    content_html: "",
    cover_image: coverImage,
    images,
    videos,
  } satisfies ExtractedMediaData;
}

function mapDouyinData(
  source: ExtractorSource,
  result: Awaited<ReturnType<typeof getDouyinDetail>>,
) {
  if (!result.data) {
    throw new Error(result.message || "Douyin extract failed.");
  }
  const images: ExtractedImage[] = [];
  const videos: ExtractedVideo[] = [];
  for (const url of result.data.downloadUrls || []) {
    if (isLikelyVideoUrl(url)) {
      addUniqueMedia(videos, url, { referer: result.data.url, source: "douyin-api" });
    } else {
      addUniqueMedia(images, url, { alt: "" });
    }
  }
  return {
    url: result.data.url || source.url,
    source_url: source.url,
    share_text: source.share_text,
    fetched_at: new Date().toISOString(),
    platform: "douyin" as const,
    platform_name: "Douyin",
    title: result.data.title || result.data.desc || "",
    account_name: result.data.authorName || "",
    author: result.data.authorName || "",
    publish_time: "",
    summary: result.data.desc || "",
    content_text: result.data.desc || result.data.title || "",
    content_html: "",
    cover_image: images[0]?.url || "",
    images,
    videos,
  } satisfies ExtractedMediaData;
}

function mapXhsData(
  source: ExtractorSource,
  result: Awaited<ReturnType<typeof getXhsDetail>>,
) {
  if (!result.data) {
    throw new Error(result.message || "Xiaohongshu extract failed.");
  }
  const images: ExtractedImage[] = [];
  const videos: ExtractedVideo[] = [];
  for (const url of result.data.downloadUrls || []) {
    if (isLikelyVideoUrl(url)) {
      addUniqueMedia(videos, url, { referer: result.data.url, source: "xhs-api" });
    } else {
      addUniqueMedia(images, url, { alt: "" });
    }
  }
  return {
    url: result.data.url || source.url,
    source_url: source.url,
    share_text: source.share_text,
    fetched_at: new Date().toISOString(),
    platform: "xiaohongshu" as const,
    platform_name: "Xiaohongshu",
    title: result.data.title || result.data.desc || "",
    account_name: result.data.authorName || "",
    author: result.data.authorName || "",
    publish_time: "",
    summary: result.data.desc || "",
    content_text: result.data.desc || result.data.title || "",
    content_html: "",
    cover_image: images[0]?.url || "",
    images,
    videos,
  } satisfies ExtractedMediaData;
}

export async function extractOpenMediaHttp(
  options: ExtractOpenMediaOptions,
): Promise<ExtractedMediaData> {
  const source = normalizeExtractorInput(options.input);
  assertAllowedPublicPlatform(source);

  if (source.platform.id === "wechat") {
    return extractWeChatData(source, options);
  }
  if (source.platform.id === "douyin") {
    const detail = await getDouyinDetail({
      url: source.raw_input || source.url,
      videoPreference: options.videoPreference as DouyinVideoPreference | undefined,
      cookie: options.cookie,
      index: options.index,
    });
    return mapDouyinData(source, detail);
  }
  if (source.platform.id === "xiaohongshu") {
    const detail = await getXhsDetail({
      url: source.raw_input || source.url,
      imageFormat: options.imageFormat,
      videoPreference: options.videoPreference as XhsVideoPreference | undefined,
      cookie: options.cookie,
      index: options.index,
    });
    return mapXhsData(source, detail);
  }
  if (source.platform.id === "bilibili") {
    return extractBilibiliData(source);
  }
  return extractSimpleHtmlMediaData(source, options);
}
