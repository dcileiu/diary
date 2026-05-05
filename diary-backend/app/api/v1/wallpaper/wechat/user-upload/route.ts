/**
 * 小程序用户投稿上传（Bearer 用户 Token）。
 * 须先过微信 img_sec_check（仅服务端可调，需 AppSecret 换 access_token）。
 * 后台批量上传请走 /api/admin/wallpapers/upload，不走本接口。
 */
import {
  absoluteAssetUrl,
  isAllowedImageUpload,
  savePublicUpload,
  UploadNotImageError,
  UploadTooLargeError,
} from "@/lib/local-upload";
import { randomWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";
import {
  formatImgSecCheckFailure,
  wechatImgSecCheckBytes,
  WECHAT_IMG_SEC_CHECK_MAX_BYTES,
} from "@/lib/wechat-img-sec-check";

const USER_UPLOAD_DEFAULT_TYPE = "待审核";
const USER_UPLOAD_DEFAULT_THEME = "";
const USER_UPLOAD_DEFAULT_TAGS = "待设置";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return mpErr(400, "无效表单");
  const uid = String(form.get("uid") ?? "");
  if (uid !== user.id) return mpUnauthorized();
  /** 投稿上传不再接收前端传入分类/主题/标签，统一写默认占位，后续由后台人工设置 */
  const type = USER_UPLOAD_DEFAULT_TYPE;
  const theme = USER_UPLOAD_DEFAULT_THEME;
  const tags = USER_UPLOAD_DEFAULT_TAGS;

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return mpErr(400, "缺少文件");
  }

  const nameHint = file instanceof File ? file.name : undefined;
  if (!isAllowedImageUpload(file, nameHint)) {
    return mpErr(400, new UploadNotImageError().message);
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength > WECHAT_IMG_SEC_CHECK_MAX_BYTES) {
    return mpErr(400, "图片须不超过 1MB");
  }

  const sec = await wechatImgSecCheckBytes(buf);
  if (!sec.ok) {
    return mpErr(400, formatImgSecCheckFailure(sec));
  }

  const mime = (file.type || "").trim();
  const blob = new Blob([buf], { type: mime || "image/jpeg" });
  let pathname: string;
  let fileName: string;
  try {
    const saved = await savePublicUpload("wallpapers", blob, nameHint);
    pathname = saved.pathname;
    fileName = saved.fileName;
  } catch (e) {
    if (e instanceof UploadNotImageError) {
      return mpErr(400, e.message);
    }
    if (e instanceof UploadTooLargeError) {
      return mpErr(400, e.message);
    }
    throw e;
  }
  const title =
    (nameHint || "")
      .replace(/\.[^/.]+$/, "")
      .trim()
      .slice(0, 255) || `用户投稿_${Date.now()}`;
  const wall = await store.upsertWallpaper({
    fileName,
    type,
    theme,
    title,
    tags,
    groupCode: randomWallpaperGroupCode(),
    hidden: true,
  });
  const url = absoluteAssetUrl(req, pathname);
  return mpOk({ fileName, url, pathname, wallpaper: wall });
}
