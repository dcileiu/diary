import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadSubdir = "entries" | "avatars" | "system" | "user_uploads";

export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
};

/**
 * 读取 Cloudflare R2 配置（S3 兼容）。
 * 三项凭证 + bucket + endpoint 任一缺失时返回 null，调用方据此回退本地存储。
 * endpoint 可直接给完整地址，或仅给 R2_ACCOUNT_ID 由本函数拼出标准 endpoint。
 */
export function r2Config(): R2Config | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const prefix = (process.env.R2_UPLOAD_PREFIX ?? "diary")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket, prefix };
}

// 配齐 R2 时所有图片都上传到 R2（含头像）。
export function shouldUploadToR2(_subdir: UploadSubdir): boolean {
  return true;
}

// 目录映射：头像 -> <prefix>/avatar，其余图片 -> <prefix>/images。
// 默认 prefix=diary，因此实际为 diary/avatar 与 diary/images。
export function r2ObjectKey(
  cfg: R2Config,
  subdir: UploadSubdir,
  fileName: string,
): string {
  const folder = subdir === "avatars" ? "avatar" : "images";
  return `${cfg.prefix}/${folder}/${fileName}`;
}

let cachedClient: { key: string; client: S3Client } | null = null;

function clientFor(cfg: R2Config): S3Client {
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedClient.key === key) return cachedClient.client;

  const client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedClient = { key, client };
  return client;
}

export async function uploadToR2(
  key: string,
  buf: Buffer,
  mime?: string,
): Promise<void> {
  const cfg = r2Config();
  if (!cfg) throw new Error("R2 config missing");

  const client = clientFor(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buf,
      ContentType: mime || "application/octet-stream",
    }),
  );
}
