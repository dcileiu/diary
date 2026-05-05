import "server-only";

import qiniu from "qiniu";

type UploadSubdir = "wallpapers" | "avatars" | "system" | "user_uploads";

export function qiniuConfig() {
  const accessKey = process.env.QINIU_ACCESS_KEY?.trim();
  const secretKey = process.env.QINIU_SECRET_KEY?.trim();
  const bucket = process.env.QINIU_BUCKET?.trim();
  const zone = process.env.QINIU_ZONE?.trim();
  const prefix = (process.env.QINIU_UPLOAD_PREFIX ?? "uploads")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!accessKey || !secretKey || !bucket) return null;
  return { accessKey, secretKey, bucket, zone: zone || null, prefix };
}

function qiniuZoneFrom(
  raw: string | null,
): (typeof qiniu.zone)[keyof typeof qiniu.zone] | null {
  if (!raw) return null;
  const z = raw.trim().toLowerCase();
  if (z === "z0" || z.includes("huadong") || z.includes("east"))
    return qiniu.zone.Zone_z0;
  if (z === "z1" || z.includes("huabei") || z.includes("north"))
    return qiniu.zone.Zone_z1;
  if (z === "z2" || z.includes("huanan") || z.includes("south"))
    return qiniu.zone.Zone_z2;
  if (z === "na0" || z.includes("na")) return qiniu.zone.Zone_na0;
  if (z === "as0" || z.includes("as")) return qiniu.zone.Zone_as0;
  return null;
}

export function shouldUploadToQiniu(subdir: UploadSubdir): boolean {
  // 用户头像明确保留本地；system 也先保留本地（你当前 system 图标在仓库内）
  if (subdir === "avatars") return false;
  if (subdir === "system") return false;
  return subdir === "wallpapers" || subdir === "user_uploads";
}

export async function uploadToQiniu(
  key: string,
  buf: Buffer,
  mime?: string,
): Promise<void> {
  const cfg = qiniuConfig();
  if (!cfg) throw new Error("Qiniu config missing");
  const mac = new qiniu.auth.digest.Mac(cfg.accessKey, cfg.secretKey);
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${cfg.bucket}:${key}`,
  });
  const uploadToken = putPolicy.uploadToken(mac);

  const zone = qiniuZoneFrom(cfg.zone);
  const conf = zone ? new qiniu.conf.Config({ zone }) : new qiniu.conf.Config();
  const formUploader = new qiniu.form_up.FormUploader(conf);
  const putExtra = new qiniu.form_up.PutExtra();
  if (mime) putExtra.mimeType = mime;

  await new Promise<void>((resolve, reject) => {
    formUploader.put(
      uploadToken,
      key,
      buf,
      putExtra,
      function (respErr, _respBody, respInfo) {
        if (respErr) {
          reject(respErr);
          return;
        }
        const code = respInfo?.statusCode ?? 0;
        if (code && code >= 300) {
          let detail = "";
          try {
            detail =
              typeof _respBody === "string"
                ? _respBody
                : _respBody
                  ? JSON.stringify(_respBody)
                  : "";
          } catch {
            detail = "";
          }
          const msg = respInfo?.error
            ? String(respInfo.error)
            : `Qiniu upload failed (HTTP ${code})`;
          reject(
            new Error(
              detail ? `${msg} · respBody=${detail} · key=${key}` : `${msg} · key=${key}`,
            ),
          );
          return;
        }
        resolve();
      },
    );
  });
}

