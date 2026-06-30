import { asText } from "@/lib/validation";

/**
 * 条目状态领域逻辑的唯一来源。
 * 路由层与服务层都从这里取，避免 normalizeStatus / isResolvedStatus 在多处各写一份。
 *
 * 注意：SQLite 下 Prisma 不支持 enum，状态以 String 存库。这里用 const 对象 + 联合类型
 * 复刻原来的枚举形态（DiaryEntryStatus.OPEN、Object.values(...)、类型注解均保持可用），
 * 取值合法性由 normalizeStatus / normalizeFollowUpType 在写入前兜底。
 */

export const DiaryEntryStatus = {
  OPEN: "OPEN",
  COOLING: "COOLING",
  RECONCILED: "RECONCILED",
  RELEASED: "RELEASED",
  ARCHIVED: "ARCHIVED",
} as const;
export type DiaryEntryStatus =
  (typeof DiaryEntryStatus)[keyof typeof DiaryEntryStatus];

export const DiaryFollowUpType = {
  NOTE: "NOTE",
  REFLECTION: "REFLECTION",
  ACTION: "ACTION",
  RESULT: "RESULT",
} as const;
export type DiaryFollowUpType =
  (typeof DiaryFollowUpType)[keyof typeof DiaryFollowUpType];

/** 已了结（视为“已解决”）的状态集合。 */
export const RESOLVED_STATUSES: readonly DiaryEntryStatus[] = [
  DiaryEntryStatus.RECONCILED,
  DiaryEntryStatus.RELEASED,
  DiaryEntryStatus.ARCHIVED,
];

/** 仍在记仇（视为“未解决”）的状态集合。 */
export const UNRESOLVED_STATUSES: readonly DiaryEntryStatus[] = [
  DiaryEntryStatus.OPEN,
  DiaryEntryStatus.COOLING,
];

const STATUS_SET = new Set<string>(Object.values(DiaryEntryStatus));
const FOLLOW_UP_SET = new Set<string>(Object.values(DiaryFollowUpType));

// 入参用 string：DB 里 status 以字符串存储，调用点常直接传 entry.status。
export function isResolvedStatus(status: string): boolean {
  return (RESOLVED_STATUSES as readonly string[]).includes(status);
}

/** 规整为合法状态；非法/缺失时回退到 OPEN。 */
export function normalizeStatus(value: unknown): DiaryEntryStatus {
  const raw = asText(value).toUpperCase();
  return STATUS_SET.has(raw)
    ? (raw as DiaryEntryStatus)
    : DiaryEntryStatus.OPEN;
}

/** 规整为合法状态；非法/缺失/ALL 时返回 null（用于“不筛选状态”）。 */
export function normalizeStatusOrNull(value: unknown): DiaryEntryStatus | null {
  const raw = asText(value).toUpperCase();
  if (!raw || raw === "ALL") return null;
  return STATUS_SET.has(raw) ? (raw as DiaryEntryStatus) : null;
}

/** 规整跟进类型；非法/缺失时回退到 NOTE。 */
export function normalizeFollowUpType(value: unknown): DiaryFollowUpType {
  const raw = asText(value).toUpperCase();
  return FOLLOW_UP_SET.has(raw)
    ? (raw as DiaryFollowUpType)
    : DiaryFollowUpType.NOTE;
}
