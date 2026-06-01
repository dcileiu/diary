import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";

/** 令牌过期/被吊销时（401）：清掉本地令牌并跳回登录页。登录页自身的 401 不处理。 */
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/admin/login")) return;
  if (!localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)) return;
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  window.location.replace("/admin/login");
}

/**
 * 管理后台请求：带时间戳 + 禁用缓存，减轻浏览器/反向代理误缓存 GET 列表（删改后仍显示旧数据）。
 * 统一拦截 401：令牌失效时自动登出，避免页面静默卡在“加载中/空白”。
 */
export async function adminApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}_=${Date.now()}`;
  const h = new Headers(init?.headers);
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-cache");
  if (!h.has("Pragma")) h.set("Pragma", "no-cache");
  const res = await fetch(url, { ...init, cache: "no-store", headers: h });
  if (res.status === 401) handleUnauthorized();
  return res;
}
