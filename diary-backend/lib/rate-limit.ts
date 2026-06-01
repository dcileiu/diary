/**
 * 轻量级内存固定窗口限流，用于保护登录类接口免遭暴力破解。
 *
 * 适用场景：当前部署为 PM2 fork 单实例（见 ecosystem.config.cjs），进程内 Map 足够。
 * 若未来扩容为多实例 / 集群，应改用 Redis 等共享存储，否则各实例计数互相独立。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** 周期性清理过期桶，避免长时间运行后 Map 无限增长。 */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** 距离窗口重置的剩余秒数，用于 Retry-After */
  retryAfterSeconds: number;
};

/**
 * @param key       维度键（建议用 `接口名:客户端IP`）
 * @param limit     窗口内允许的最大次数
 * @param windowMs  窗口长度（毫秒）
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** 从常见反代头里解析客户端 IP，取最左侧（最接近真实客户端）的地址。 */
export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
