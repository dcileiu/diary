/**
 * 极简结构化日志。统一所有服务端日志出口，便于后续接入日志采集（按 JSON 行解析）。
 *
 * 设计取舍：
 * - 不引入第三方日志库，避免额外依赖与初始化成本；
 * - 统一输出 JSON 行（time/level/scope/message），生产环境可被 PM2 / 采集 agent 直接消费；
 * - 仅在 error 级别输出 stack，避免 info/warn 噪声。
 */

type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

function emit(level: LogLevel, scope: string, message: string, meta?: LogMeta) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(scope: string, message: string, meta?: LogMeta) {
  emit("info", scope, message, meta);
}

export function logWarn(scope: string, message: string, meta?: LogMeta) {
  emit("warn", scope, message, meta);
}

/** 记录异常。生产环境同样保留 stack 到日志（不会返回给客户端）。 */
export function logError(scope: string, error: unknown, meta?: LogMeta) {
  if (error instanceof Error) {
    emit("error", scope, error.message, { stack: error.stack, ...meta });
  } else {
    emit("error", scope, String(error), meta);
  }
}
