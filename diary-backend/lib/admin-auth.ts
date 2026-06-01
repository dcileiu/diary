import { timingSafeEqual } from "crypto";

/**
 * 后台凭据校验。仅负责“账号密码是否正确”，令牌的签发/校验/吊销交给 admin-session。
 *
 * 使用 process.env[key] 动态读变量，避免 Next 构建阶段把具体变量名内联成当时的值
 *（例如在 CI 无 .env 时 build，导致线上永远读到空/旧值）。
 */
function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v.trim();
}

/**
 * 恒定时间字符串比较，避免登录校验因为 `===` 的提前返回而泄漏长度或前缀，
 * 从而被时序攻击逐字符爆破。长度不同也会走完整 compare 流程。
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

type AdminCredentials = {
  username: string;
  password: string;
};

function readAdminCredentials(): AdminCredentials | null {
  const username = readEnv("ADMIN_USERNAME");
  const password = readEnv("ADMIN_PASSWORD");
  if (!username || !password) return null;
  return { username, password };
}

export function isAdminAuthConfigured(): boolean {
  return readAdminCredentials() !== null;
}

/**
 * 校验账号密码。正确返回 { username }，否则返回 null。
 * 两个比较都执行，避免“用户名是否正确”通过响应时间泄漏。
 */
export function verifyAdminCredentials(body: {
  username?: string;
  password?: string;
}): { username: string } | null {
  const cfg = readAdminCredentials();
  if (!cfg) return null;
  const u = String(body.username ?? "").trim();
  const p = String(body.password ?? "").trim();
  const userOk = safeEqual(u, cfg.username);
  const passOk = safeEqual(p, cfg.password);
  return userOk && passOk ? { username: cfg.username } : null;
}
