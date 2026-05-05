import { getWallpaperStore } from "@/lib/wallpaper-store";
import {
  absoluteAssetUrl,
  savePublicUpload,
  UploadNotImageError,
  UploadTooLargeError,
} from "@/lib/local-upload";
import { randomWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { mpErr, mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_TYPE = "美女";
const DEFAULT_THEME = "美女、小姐姐、好看";
const DEFAULT_TAGS = "美女,模特";

function stem(name: string) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s.replace(/\.[^/.]+$/, "").trim();
}

function assertApiKey(req: Request) {
  const expected = process.env.OPEN_UPLOAD_API_KEY?.trim();
  if (!expected) return { ok: false as const, status: 500, msg: "服务端未配置 OPEN_UPLOAD_API_KEY" };
  const got =
    req.headers.get("x-api-key")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!got || got !== expected) {
    return { ok: false as const, status: 401, msg: "未授权" };
  }
  return { ok: true as const };
}

function collectFiles(form: FormData): File[] {
  const keys = ["file", "files", "data", "image", "images"];
  const out: File[] = [];
  for (const key of keys) {
    const values = form.getAll(key);
    for (const v of values) {
      if (v instanceof File && v.size > 0) out.push(v);
    }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const auth = assertApiKey(req);
    if (!auth.ok) return mpErr(auth.status, auth.msg);

    const form = await req.formData().catch(() => null);
    if (!form) return mpErr(400, "无效表单");

    const files = collectFiles(form);
    if (!files.length) {
      return mpErr(400, "缺少图片文件（支持字段：file/files/data/image/images）");
    }

    // 同一批次共用组编号，便于后续按组检索
    const groupCode = randomWallpaperGroupCode();
    const store = getWallpaperStore();

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { pathname, fileName } = await savePublicUpload(
          "wallpapers",
          file,
          file.name,
          { groupCode },
        );
        const title = stem(file.name) || fileName;
        const row = await store.upsertWallpaper({
          groupCode,
          fileName,
          type: DEFAULT_TYPE,
          theme: DEFAULT_THEME,
          title,
          tags: DEFAULT_TAGS,
          hidden: false,
        });
        return {
          wallpapersId: row.wallpapersId,
          groupCode,
          fileName,
          title,
          type: row.type,
          theme: row.theme ?? "",
          tags: row.tags,
          hidden: !!row.hidden,
          url: absoluteAssetUrl(req, pathname),
          pathname,
        };
      }),
    );

    return mpOk({
      count: uploaded.length,
      defaults: {
        type: DEFAULT_TYPE,
        theme: DEFAULT_THEME,
        tags: DEFAULT_TAGS,
        hidden: false,
      },
      files: uploaded,
    });
  } catch (e) {
    if (e instanceof UploadNotImageError) {
      return mpErr(400, e.message);
    }
    if (e instanceof UploadTooLargeError) {
      return mpErr(413, e.message);
    }
    console.error("[open/wallpapers/upload]", e);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `上传失败: ${mpErrorMessage(e)}`
        : "服务暂不可用，请稍后重试",
    );
  }
}
