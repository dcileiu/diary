const ALNUM =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomAlnum(n: number): string {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < n; i++) s += ALNUM[buf[i]! % ALNUM.length];
  return s;
}

/** Current default avatar path for newly registered mini-program users. */
export const MINI_PROGRAM_DEFAULT_AVATAR_PATH =
  "/uploads/system/default_avatar.jpg";

/** Legacy site-hosted default avatar path kept for compatibility. */
export const MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH =
  "/uploads/system/default_avatar.jpg";

/** New user nickname format: 记仇用户 + 5 alphanumeric chars. */
export function defaultMiniProgramNickname(): string {
  return `记仇用户${randomAlnum(5)}`;
}
