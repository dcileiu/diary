/**
 * 通用输入解析/规整原语。所有路由与服务层共享同一套清洗逻辑，避免各处重复实现导致行为漂移。
 * 这些函数都是纯函数、无副作用，方便单元测试。
 */

/** 转成去除首尾空白的字符串；null/undefined 视为空串。 */
export function asText(value: unknown): string {
  return String(value ?? "").trim();
}

/** 仅接受正整数，否则返回 null。 */
export function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** 把数值钳制到 [1,5] 的整数等级；非法输入回退到 fallback。 */
export function clampLevel(value: unknown, fallback = 3): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** 把任意值钳制到 [min,max] 的整数；非法回退到 fallback。 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback = 0,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** 解析日期输入，非法返回 null（不会回退到“当前时间”，由调用方决定语义）。 */
export function parseDateInput(value: unknown): Date | null {
  const raw = asText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** 解析逗号字符串或数组为去重后的正整数列表。 */
export function normalizeIdList(value: unknown): number[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(
    new Set(
      raw
        .map((item) => positiveInt(item))
        .filter((item): item is number => item != null),
    ),
  );
}

/**
 * 列表分页参数：返回安全的 page / pageSize / skip / take。
 * @param maxPageSize 单页上限，防止超大查询拖垮数据库。
 */
export function parsePagination(
  pageInput: unknown,
  pageSizeInput: unknown,
  options?: { defaultPageSize?: number; maxPageSize?: number },
): { page: number; pageSize: number; skip: number; take: number } {
  const defaultPageSize = options?.defaultPageSize ?? 10;
  const maxPageSize = options?.maxPageSize ?? 50;
  const page = Math.max(1, positiveInt(pageInput) ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(maxPageSize, positiveInt(pageSizeInput) ?? defaultPageSize),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
