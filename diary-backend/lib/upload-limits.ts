/**
 * 全站图片单文件大小上限（与 Nginx client_max_body_size、savePublicUpload 一致）。
 * 无 Node 专属依赖，可在客户端组件中引用文案。
 */
export const MAX_IMAGE_UPLOAD_MB = 20;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
