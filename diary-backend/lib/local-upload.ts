import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import {
  absoluteAssetUrl,
  absolutePublicUrl,
  requestPublicAssetOrigin,
  requestPublicOrigin,
  upgradeSameHostAvatarHttpToHttps,
} from "./public-origin";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_MB } from "./upload-limits";

export {
  absoluteAssetUrl,
  absolutePublicUrl,
  requestPublicAssetOrigin,
  requestPublicOrigin,
  upgradeSameHostAvatarHttpToHttps,
};

const UPLOAD_ROOT = process.env.UPLOAD_STORAGE_ROOT?.trim()
  ? path.resolve(process.env.UPLOAD_STORAGE_ROOT.trim())
  : path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");

export function getUploadStorageRoot(): string {
  return UPLOAD_ROOT;
}

type UploadSubdir = "entries" | "avatars" | "system" | "user_uploads";

const IMAGE_FILENAME_EXT =
  /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif|ico|jfif)$/i;

export class UploadNotImageError extends Error {
  override readonly name = "UploadNotImageError";

  constructor(
    message =
      "Only image uploads are supported. Please use a common format like JPG, PNG, WebP, or GIF.",
  ) {
    super(message);
  }
}

export class UploadTooLargeError extends Error {
  override readonly name = "UploadTooLargeError";

  constructor(
    message = `A single image must not exceed ${MAX_IMAGE_UPLOAD_MB}MB`,
  ) {
    super(message);
  }
}

export function isAllowedImageUpload(blob: Blob, nameHint?: string): boolean {
  const mime = (blob.type || "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;

  if (!mime || mime === "application/octet-stream") {
    const fileName = nameHint?.trim() ?? "";
    return fileName.length > 0 && IMAGE_FILENAME_EXT.test(fileName);
  }

  return false;
}

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
    const matched = /\.([a-z0-9]+)$/i.exec(nameHint.trim());
    if (matched) {
      const fromName = matched[1].toLowerCase();
      if (SAFE_EXT_FROM_FILENAME.has(fromName)) {
        return fromName === "jpe" ? "jpg" : fromName;
      }
    }
  }

  const mime = blob.type?.toLowerCase() ?? "";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("heif")) return "heif";
  if (mime.includes("avif")) return "avif";

  if (nameHint) {
    const matched = /\.([a-z0-9]+)$/i.exec(nameHint.trim());
    if (matched) return matched[1].toLowerCase();
  }

  return "bin";
}

export type SavePublicUploadOptions = {
  groupCode?: string;
};

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
      "Could not detect the image format. Please use JPG, PNG, WebP, GIF, or another common image format.",
    );
  }

  const rawGroup = options?.groupCode?.trim() ?? "";
  const safeGroup = /^\d{4,6}$/.test(rawGroup) ? rawGroup : "";
  const base = safeGroup
    ? `${safeGroup}_${Date.now()}_${randomBytes(3).toString("hex")}`
    : `${Date.now()}_${randomBytes(6).toString("hex")}`;
  const fileName = `${base}.${ext}`;
  const buf = Buffer.from(await blob.arrayBuffer());

  const { qiniuConfig, shouldUploadToQiniu, uploadToQiniu } = await import(
    "./qiniu-upload"
  );
  const cfg = qiniuConfig();
  const useQiniu = cfg && shouldUploadToQiniu(subdir);

  if (useQiniu) {
    const key = `${cfg.prefix}/${subdir}/${fileName}`;
    await uploadToQiniu(key, buf, blob.type || undefined);
    return {
      pathname: `/${cfg.prefix}/${subdir}/${fileName}`,
      fileName,
    };
  }

  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, buf);

  return {
    pathname: `/uploads/${subdir}/${fileName}`,
    fileName,
  };
}
