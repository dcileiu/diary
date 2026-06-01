import "server-only";

import { createHash, randomBytes } from "crypto";

import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_HOURS = 168; // 7 天
const MIN_TTL_HOURS = 1;
const MAX_TTL_HOURS = 24 * 90; // 90 天

/** 距上次活跃超过该阈值才回写 last_seen_at，避免每个请求都产生一次写入。 */
const LAST_SEEN_REFRESH_MS = 5 * 60_000;

/** 后台令牌有效期（毫秒），可用 ADMIN_SESSION_TTL_HOURS 调整。 */
export function sessionTtlMs(): number {
  const raw = Number(process.env.ADMIN_SESSION_TTL_HOURS);
  const hours = Number.isFinite(raw)
    ? Math.min(MAX_TTL_HOURS, Math.max(MIN_TTL_HOURS, raw))
    : DEFAULT_TTL_HOURS;
  return hours * 60 * 60_000;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** 从 Authorization 头提取 Bearer 令牌，无则返回空串。 */
export function bearerToken(req: Request): string {
  const authorization = req.headers.get("authorization") ?? "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

export type IssuedAdminSession = {
  token: string;
  expiresAt: Date;
};

/** 登录成功后签发新会话：返回原始令牌（仅此一次可见），库内只存其哈希。 */
export async function createAdminSession(meta: {
  username: string;
  ip?: string;
  userAgent?: string;
}): Promise<IssuedAdminSession> {
  const token = randomBytes(32).toString("hex"); // 256-bit 不透明令牌
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      username: (meta.username ?? "").slice(0, 64),
      ip: (meta.ip ?? "").slice(0, 64),
      userAgent: (meta.userAgent ?? "").slice(0, 255),
      expiresAt,
    },
  });

  // 顺手清理过期会话（best-effort，不阻塞登录返回）。
  void pruneExpiredSessions();

  return { token, expiresAt };
}

/**
 * 校验请求携带的会话令牌是否有效。
 * - 命中且未过期 → true（并按节流回写 last_seen_at）；
 * - 已过期 → 删除该会话并返回 false；
 * - 未命中/无令牌 → false。
 */
export async function isAuthorizedAdminRequest(req: Request): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;

  const tokenHash = hashToken(token);
  const session = await prisma.adminSession.findUnique({ where: { tokenHash } });
  if (!session) return false;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession
      .delete({ where: { id: session.id } })
      .catch((error) => logError("admin-session:delete-expired", error));
    return false;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    await prisma.adminSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch((error) => logError("admin-session:touch", error));
  }

  return true;
}

/** 主动吊销（退出登录）：删除该令牌对应的会话。 */
export async function revokeAdminSession(rawToken: string): Promise<void> {
  const token = (rawToken ?? "").trim();
  if (!token) return;
  await prisma.adminSession
    .deleteMany({ where: { tokenHash: hashToken(token) } })
    .catch((error) => logError("admin-session:revoke", error));
}

/** 清理所有已过期会话；登录时顺带触发，失败仅记录不抛出。 */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.adminSession
    .deleteMany({ where: { expiresAt: { lte: new Date() } } })
    .catch((error) => logError("admin-session:prune", error));
}
