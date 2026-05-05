import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import sharp from "sharp";

import { getUploadStorageRoot } from "@/lib/local-upload";

/** 列表缩略图最大边（px），仅缩小不放大 */
export const WALLPAPER_THUMB_MAX_WIDTH = 360;

const SAFE_WALLPAPER_FILE = /^[a-zA-Z0-9._-]+$/;

export function wallpaperFileStem(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "") || fileName;
}

export function assertSafeWallpaperFileName(fileName: string): string | null {
  const base = path.basename(fileName);
  if (base !== fileName || !SAFE_WALLPAPER_FILE.test(base)) return null;
  return base;
}

/**
 * 读取或生成壁纸 WebP 缩略图（写入 `public/uploads/wallpapers/thumbs/` 供后续直出）。
 * SVG 不生成旁路文件，直接返回原文件内容。
 */
export async function getOrCreateWallpaperThumb(
  fileName: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const safe = assertSafeWallpaperFileName(fileName);
  if (!safe) return null;

  const root = getUploadStorageRoot();
  const origPath = path.join(root, "wallpapers", safe);

  try {
    await access(origPath);
  } catch {
    return null;
  }

  const ext = path.extname(safe).toLowerCase();
  if (ext === ".svg") {
    const body = await readFile(origPath);
    return { body, contentType: "image/svg+xml" };
  }

  const thumbDir = path.join(root, "wallpapers", "thumbs");
  const thumbPath = path.join(thumbDir, `${wallpaperFileStem(safe)}_t.webp`);

  try {
    const body = await readFile(thumbPath);
    return { body, contentType: "image/webp" };
  } catch {
    /* 首次访问：生成并落盘 */
  }

  await mkdir(thumbDir, { recursive: true });
  try {
    const resized = await sharp(origPath)
      .rotate()
      .resize({
        width: WALLPAPER_THUMB_MAX_WIDTH,
        withoutEnlargement: true,
      })
      .webp({ quality: 72, effort: 5 })
      .toBuffer();
    await writeFile(thumbPath, resized);
    return { body: resized, contentType: "image/webp" };
  } catch (e) {
    console.error("[wallpaper-thumbnail] failed", safe, e);
    return null;
  }
}

/** 上传成功后异步预热缩略图（失败忽略，首屏列表仍可由公开接口按需生成） */
export function scheduleWallpaperThumbWarm(fileName: string): void {
  void getOrCreateWallpaperThumb(fileName).catch((e) => {
    console.error("[wallpaper-thumbnail] warm", fileName, e);
  });
}
