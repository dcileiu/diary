/**
 * 管理后台请求：带时间戳 + 禁用缓存，减轻浏览器/反向代理误缓存 GET 列表（删改后仍显示旧数据）。
 */
export function adminApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}_=${Date.now()}`;
  const h = new Headers(init?.headers);
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-cache");
  if (!h.has("Pragma")) h.set("Pragma", "no-cache");
  return fetch(url, { ...init, cache: "no-store", headers: h });
}
