import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from "./upload-limits";

/**
 * 上传落盘根目录（其下含 entries、avatars、user_uploads 等子目录）。
 * - 默认：`{process.cwd()}/public/uploads`（与 `npm start` 的 cwd=项目根一致）
 * - 生产若 cwd 非项目根、或多实例挂载盘不一致，请设绝对路径，并与 Nginx `location /uploads/` 的 root/alias 指向同一 `public` 目录
 */
const UPLOAD_ROOT = process.env.UPLOAD_STORAGE_ROOT?.trim()
  ? path.resolve(process.env.UPLOAD_STORAGE_ROOT.trim())
  : path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");

/** 与 `savePublicUpload` 落盘根目录一致，供缩略图等模块解析原图路径 */
export function getUploadStorageRoot(): string {
  return UPLOAD_ROOT;
}

function isLocalHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** 本机或常见内网 IP：默认仍可用 http，便于无 TLS 的本地/局域网调试 */
function isPrivateOrLocalHost(host: string): boolean {
  if (isLocalHost(host)) return true;
  const h = host.split(":")[0] ?? "";
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/i.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(h)) return true;
  const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/i.exec(h);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * 小程序 / 浏览器可用的绝对资源地址（考虑反向代理）。
 * - 优先 `PUBLIC_SITE_ORIGIN`；无协议时按 **https** 解析。
 * - 未配置 env 时：公网 Host **默认 https**；仅本机/内网 Host 在缺少头时用 http（本地开发）。
 * - 公网 Host 即使用户头里带 `http`，也统一升为 **https**（与小程序、线上规范一致）。
 */
export function requestPublicOrigin(req: Request): string {
  const fromEnv = process.env.PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) {
    try {
      const raw = /^https?:\/\//i.test(fromEnv)
        ? fromEnv
        : `https://${fromEnv}`;
      const o = new URL(raw);
      const p = o.protocol === "http:" && !isPrivateOrLocalHost(o.host) ? "https:" : o.protocol;
      return `${p}//${o.host}`;
    } catch {
      /* fall through */
    }
  }

  const u = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? u.host;

  const fwdRaw = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const fwd = fwdRaw?.toLowerCase();
  let proto: string;
  if (fwd === "https" || fwd === "http") {
    proto = fwd;
  } else {
    proto = isPrivateOrLocalHost(host)
      ? u.protocol.replace(":", "") || "http"
      : "https";
  }

  if (proto === "http" && !isPrivateOrLocalHost(host)) {
    proto = "https";
  }

  return `${proto}://${host}`;
}

/** 图片/静态资源域名（如七牛 CDN）。未配置时回退到站点域名。 */
export function requestPublicAssetOrigin(req: Request): string {
  const fromEnv = process.env.PUBLIC_ASSET_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) {
    try {
      const raw = /^https?:\/\//i.test(fromEnv)
        ? fromEnv
        : `https://${fromEnv}`;
      const o = new URL(raw);
      return `${o.protocol}//${o.host}`;
    } catch {
      /* fall through */
    }
  }
  return requestPublicOrigin(req);
}

export function absolutePublicUrl(req: Request, pathname: string): string {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${requestPublicOrigin(req)}${p}`;
}

export function absoluteAssetUrl(req: Request, pathname: string): string {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${requestPublicAssetOrigin(req)}${p}`;
}

/**
 * 将「本站域名、协议为 http」的头像 URL 升为 https（小程序要求）。
 * @param siteOrigin 本站源，如 https://api.example.com（来自本次请求或 PUBLIC_SITE_ORIGIN）
 */
export function upgradeSameHostAvatarHttpToHttps(
  avatar: string,
  siteOrigin: string,
): string | null {
  const raw = siteOrigin.trim().replace(/\/$/, "");
  if (!raw) return null;
  let site: URL;
  try {
    site = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const siteHost = site.hostname.toLowerCase();
  const a = avatar.trim();
  if (!/^https?:\/\//i.test(a)) return null;
  let u: URL;
  try {
    u = new URL(a);
  } catch {
    return null;
  }
  if (u.protocol !== "http:") return null;
  if (u.hostname.toLowerCase() !== siteHost) return null;
  return `https://${u.host}${u.pathname}${u.search}${u.hash}`;
}

type UploadSubdir = "entries" | "avatars" | "system" | "user_uploads";

/** 无 MIME 时凭扩展名识别为常见图片（与后台内容页逻辑一致） */
const IMAGE_FILENAME_EXT =
  /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif|ico|jfif)$/i;

export class UploadNotImageError extends Error {
  override readonly name = "UploadNotImageError";
  constructor(
    message = "仅支持上传图片文件（如 JPG、PNG、WebP、GIF；若系统未返回类型，请使用带图片扩展名的文件）",
  ) {
    super(message);
  }
}

export class UploadTooLargeError extends Error {
  override readonly name = "UploadTooLargeError";
  constructor(
    message = `单张图片不能超过 ${MAX_IMAGE_UPLOAD_MB}MB`,
  ) {
    super(message);
  }
}

/**
 * 是否允许作为图片上传：`image/*`，或空/`application/octet-stream` 且扩展名为常见图片。
 */
export function isAllowedImageUpload(blob: Blob, nameHint?: string): boolean {
  const mime = (blob.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (!mime || mime === "application/octet-stream") {
    const n = nameHint?.trim() ?? "";
    return n.length > 0 && IMAGE_FILENAME_EXT.test(n);
  }
  return false;
}

/** 允许从原始文件名继承的扩展名（小写、无点）；其余走 MIME 推断，避免 .exe 等 */
const SAFE_EXT_FROM_FILENAME = new Set([
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "png",
  "webp",
  "gif",
  "svg",
  "bmp",
  "avif",
  "heic",
  "heif",
  "ico",
]);

function extFrom(blob: Blob, nameHint?: string): string {
  if (nameHint) {
    const m = /\.([a-z0-9]+)$/i.exec(nameHint.trim());
    if (m) {
      const fromName = m[1].toLowerCase();
      if (SAFE_EXT_FROM_FILENAME.has(fromName)) {
        if (fromName === "jpe") return "jpg";
        return fromName;
      }
    }
  }

  const t = blob.type?.toLowerCase() ?? "";
  if (t.includes("png")) return "png";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("svg")) return "svg";
  if (t.includes("bmp")) return "bmp";
  if (t.includes("heic")) return "heic";
  if (t.includes("heif")) return "heif";
  if (t.includes("avif")) return "avif";
  if (nameHint) {
    const m = /\.([a-z0-9]+)$/i.exec(nameHint.trim());
    if (m) return m[1].toLowerCase();
  }
  return "bin";
}

export type SavePublicUploadOptions = {
  /** 壁纸组编号（4～6 位数字），生成 `{groupCode}_{timestamp}_{rand}.ext` */
  groupCode?: string;
};

/** 写入 `public/uploads/{subdir}/`，返回 Web 路径与文件名（仅文件名，便于小程序拼 `imgURL`） */
export async function savePublicUpload(
  subdir: UploadSubdir,
  blob: Blob,
  nameHint?: string,
  options?: SavePublicUploadOptions,
): Promise<{ pathname: string; fileName: string }> {
  if (!isAllowedImageUpload(blob, nameHint)) {
    throw new UploadNotImageError();
  }
  if (blob.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new UploadTooLargeError();
  }
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const ext = extFrom(blob, nameHint);
  if (ext === "bin") {
    throw new UploadNotImageError(
      "无法识别该图片格式，请使用 JPG、PNG、WebP、GIF 等常见格式",
    );
  }
  const gc = options?.groupCode?.trim() ?? "";
  const safeGroup = /^\d{4,6}$/.test(gc) ? gc : "";
  const base = safeGroup
    ? `${safeGroup}_${Date.now()}_${randomBytes(3).toString("hex")}`
    : `${Date.now()}_${randomBytes(6).toString("hex")}`;
  const fileName = `${base}.${ext}`;
  const buf = Buffer.from(await blob.arrayBuffer());

  // 七牛上传逻辑只在需要时运行时加载，避免构建期把整个 SDK 打进包里
  const { qiniuConfig, shouldUploadToQiniu, uploadToQiniu } = await import(
    "./qiniu-upload"
  );
  const cfg = qiniuConfig();
  const useQiniu = cfg && shouldUploadToQiniu(subdir);
  if (useQiniu) {
    const key = `${cfg.prefix}/${subdir}/${fileName}`;
    await uploadToQiniu(key, buf, blob.type || undefined);
    const pathname = `/${cfg.prefix}/${subdir}/${fileName}`;
    return { pathname, fileName };
  }

  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, buf);
  const pathname = `/uploads/${subdir}/${fileName}`;
  return { pathname, fileName };
}
