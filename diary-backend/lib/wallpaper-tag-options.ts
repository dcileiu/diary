/** 仅用于 prisma seed / 无库内存模式初始数据；后台多选标签以数据库 wallpaper_tag 为准 */
export const WALLPAPER_TAG_PRESETS: readonly string[] = [
  "风景",
  "自然",
  "极简",
  "生活",
  "插画",
  "卡通",
  "城市",
  "视觉",
  "创意",
  "抽象",
];

export function splitWallpaperTagsField(field: string): string[] {
  return field
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @deprecated 标签改由 wallpaper_tag 表维护；保留供脚本或兼容引用 */
export function mergeWallpaperTagOptions(fromWallpapers: string[]): string[] {
  const set = new Set<string>(WALLPAPER_TAG_PRESETS);
  for (const t of fromWallpapers) {
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
