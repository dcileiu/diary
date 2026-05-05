const ALNUM =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomAlnum(n: number): string {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < n; i++) s += ALNUM[buf[i]! % ALNUM.length];
  return s;
}

/** Current default avatar for newly registered mini-program users. */
export const MINI_PROGRAM_DEFAULT_AVATAR_URL =
  "https://wallpaper.cdn.itianci.cn/wallpaper-wx/default-avatar.webp";

/** Legacy site-hosted default avatar path kept for old-user migration. */
export const MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH =
  "/uploads/system/default_avatar.jpg";

/** New user nickname format: 大侠 + 5 alphanumeric chars. */
export function defaultMiniProgramNickname(): string {
  return `大侠${randomAlnum(5)}`;
}
