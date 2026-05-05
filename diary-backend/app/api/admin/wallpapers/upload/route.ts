/**
 * 后台管理端壁纸文件上传（Bearer 管理 Token）。
 * 与小程序用户上传（api/v1/wallpaper/wechat/user-upload）分离；
 * 管理端信任运营人员，不做微信 img_sec_check。
 */
import { isAdminRequest } from "@/lib/admin-auth";
import {
  absoluteAssetUrl,
  absolutePublicUrl,
  savePublicUpload,
  UploadNotImageError,
  UploadTooLargeError,
} from "@/lib/local-upload";
import { isValidWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  if (!isAdminRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ code: 401, message: "未授权" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ code: 400, message: "无效表单" }, { status: 400 });
  }
  const groupCodeRaw = form.get("groupCode");
  const groupCodeStr =
    typeof groupCodeRaw === "string" ? groupCodeRaw.trim() : "";
  if (groupCodeStr && !isValidWallpaperGroupCode(groupCodeStr)) {
    return NextResponse.json(
      { code: 400, message: "groupCode 须为 4～6 位数字" },
      { status: 400 },
    );
  }
  const uploadOpts = groupCodeStr
    ? { groupCode: groupCodeStr }
    : undefined;

  const raw = form.getAll("file");
  const blobs: Blob[] = [];
  for (const v of raw) {
    if (typeof v === "string") continue;
    if (v instanceof Blob && v.size > 0) blobs.push(v);
  }
  if (!blobs.length) {
    return NextResponse.json({ code: 400, message: "缺少文件" }, { status: 400 });
  }
  let files: { fileName: string; url: string; pathname: string }[];
  try {
    files = await Promise.all(
      blobs.map(async (blob) => {
        const nameHint = blob instanceof File ? blob.name : undefined;
        const { pathname, fileName } = await savePublicUpload(
          "wallpapers",
          blob,
          nameHint,
          uploadOpts,
        );
        const url = absoluteAssetUrl(req, pathname);
        return { fileName, url, pathname };
      }),
    );
  } catch (e) {
    if (e instanceof UploadNotImageError) {
      return NextResponse.json(
        { code: 400, message: e.message },
        { status: 400 },
      );
    }
    if (e instanceof UploadTooLargeError) {
      return NextResponse.json(
        { code: 400, message: e.message },
        { status: 413 },
      );
    }
    throw e;
  }
  // 缩略图由 CDN 实时参数生成即可；这里保留空操作兼容
  if (files.length === 1) {
    const one = files[0]!;
    return NextResponse.json({
      code: 0,
      data: {
        fileName: one.fileName,
        url: one.url,
        pathname: one.pathname,
        files: [one],
      },
    });
  }
  return NextResponse.json({ code: 0, data: { files } });
}
