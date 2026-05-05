/**
 * 使用 process.env[key] 动态读变量，避免 Next 构建阶段把具体变量名内联成当时的值
 *（例如在 CI 无 .env 时 build，导致线上永远读到空/旧值）。
 */
function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v.trim();
}

type AdminAuthConfig = {
  username: string;
  password: string;
  accessToken: string;
};

function readAdminAuthConfig(): AdminAuthConfig | null {
  const username = readEnv("ADMIN_USERNAME");
  const password = readEnv("ADMIN_PASSWORD");
  const accessToken = readEnv("ADMIN_ACCESS_TOKEN");
  if (!username || !password || !accessToken) return null;
  return { username, password, accessToken };
}

export function isAdminAuthConfigured(): boolean {
  return readAdminAuthConfig() !== null;
}

export function adminLogin(body: { username?: string; password?: string }) {
  const cfg = readAdminAuthConfig();
  if (!cfg) return null;
  const u = String(body.username ?? "").trim();
  const p = String(body.password ?? "").trim();
  if (u === cfg.username && p === cfg.password) {
    return { accessToken: cfg.accessToken };
  }
  return null;
}

export function isAdminRequest(authorization: string | null) {
  const cfg = readAdminAuthConfig();
  if (!cfg) return false;
  if (!authorization) return false;
  const tok = authorization.replace(/^Bearer\s+/i, "").trim();
  return tok === cfg.accessToken;
}
