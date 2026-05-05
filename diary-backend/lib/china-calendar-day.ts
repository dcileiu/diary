/** 当前时刻对应的「中国日历日」起止（UTC Date，用于与 DB 中 DateTime 比较） */
export function chinaDayRangeUtc(now = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !d) {
    const t = now.getTime();
    return { start: new Date(t - (t % 86400000)), end: new Date(t - (t % 86400000) + 86400000) };
  }
  const start = new Date(`${y}-${mo}-${d}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
