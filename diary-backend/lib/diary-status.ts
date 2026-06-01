import { DiaryEntryStatus, DiaryFollowUpType } from "@prisma/client";

import { asText } from "@/lib/validation";

/**
 * 条目状态领域逻辑的唯一来源。
 * 路由层与服务层都从这里取，避免 normalizeStatus / isResolvedStatus 在多处各写一份。
 */

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

export function isResolvedStatus(status: DiaryEntryStatus): boolean {
  return RESOLVED_STATUSES.includes(status);
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
