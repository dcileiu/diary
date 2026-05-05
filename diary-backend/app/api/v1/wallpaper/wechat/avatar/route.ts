/**
 * 小程序用户换头像（Bearer 用户 Token）。
 * 与「我的上传」不同：本接口不做微信 img_sec_check；若需对用户头像做内容安全，可在此接入或与 user-upload 共用检测逻辑。
 */
import {
  absolutePublicUrl,
  isAllowedImageUpload,
  savePublicUpload,
  UploadNotImageError,
  UploadTooLargeError,
} from "@/lib/local-upload";
import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErr, mpOk, mpUnauthorized } from "@/lib/mp-api";

export async function POST(req: Request) {
  const store = getWallpaperStore();
  const user = await store.authUser(req.headers.get("authorization"));
  if (!user) return mpUnauthorized();
  const form = await req.formData().catch(() => null);
  if (!form) return mpErr(400, "无效表单");
  const uid = String(form.get("uid") ?? "");
  if (uid !== user.id) return mpUnauthorized();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return mpErr(400, "缺少文件");
  }
  const nameHint = file instanceof File ? file.name : undefined;
  if (!isAllowedImageUpload(file, nameHint)) {
    return mpErr(400, new UploadNotImageError().message);
  }
  let pathname: string;
  try {
    const saved = await savePublicUpload("avatars", file, nameHint);
    pathname = saved.pathname;
  } catch (e) {
    if (e instanceof UploadNotImageError) {
      return mpErr(400, e.message);
    }
    if (e instanceof UploadTooLargeError) {
      return mpErr(400, e.message);
    }
    throw e;
  }
  const avatarUrl = absolutePublicUrl(req, pathname);
  const updated = await store.updateAvatar(uid, avatarUrl);
  if (!updated) return mpErr(404, "用户不存在");
  return mpOk(updated);
}
