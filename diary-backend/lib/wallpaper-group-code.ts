/** 壁纸「组编号」：同一次上传的一组图共用，与 wallpapersId（库主键）无关 */
export const WALLPAPER_GROUP_CODE_REGEX = /^\d{4,6}$/;

export function isValidWallpaperGroupCode(s: string): boolean {
  return WALLPAPER_GROUP_CODE_REGEX.test(s.trim());
}

/** 生成 4～6 位随机数字编号（前端/后台均可调用） */
export function randomWallpaperGroupCode(): string {
  const len = 4 + Math.floor(Math.random() * 3);
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
