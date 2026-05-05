import type { Prisma } from "@prisma/client";
import {
  MINI_PROGRAM_DEFAULT_AVATAR_URL,
  MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH,
} from "@/lib/wx-user-defaults";

/** Historical CDN default avatar (png). */
export const LEGACY_PUTABLECLOTH_DEFAULT_AVATAR =
  "https://img.putablecloth.com/wallpapers/system/default_avatar.png";

export const LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH =
  "/uploads/system/default_avatar.png";

/** Whether the avatar is still one of the old system default avatar values. */
export function isLegacyDefaultAvatarUrl(
  avatar: string,
  opts?: { siteOrigin?: string },
): boolean {
  const a = avatar.trim();
  if (!a) return false;
  if (a === MINI_PROGRAM_DEFAULT_AVATAR_URL) return false;
  if (a === LEGACY_PUTABLECLOTH_DEFAULT_AVATAR) return true;
  if (a === LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH) return true;
  if (a === MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH) return true;
  if (a.includes(LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH)) return true;
  if (a.includes(MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH)) return true;
  if (a.endsWith("/system/default_avatar.png")) return true;
  if (a.endsWith("/system/default_avatar.jpg")) return true;
  const origin = opts?.siteOrigin?.replace(/\/$/, "");
  if (origin && a === `${origin}${LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH}`) {
    return true;
  }
  if (origin && a === `${origin}${MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH}`) {
    return true;
  }
  return false;
}

/** Prisma where clause aligned with isLegacyDefaultAvatarUrl. */
export function prismaWhereLegacyDefaultAvatars(
  siteOrigin: string,
): Prisma.WxUserWhereInput {
  const origin = siteOrigin.replace(/\/$/, "");
  return {
    OR: [
      { avatar: LEGACY_PUTABLECLOTH_DEFAULT_AVATAR },
      { avatar: `${origin}${LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH}` },
      { avatar: `${origin}${MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH}` },
      { avatar: LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH },
      { avatar: MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH },
      { avatar: { endsWith: LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH } },
      { avatar: { contains: LEGACY_SITE_DEFAULT_AVATAR_PNG_PATH } },
      { avatar: { endsWith: MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH } },
      { avatar: { contains: MINI_PROGRAM_LEGACY_DEFAULT_AVATAR_PATH } },
      { avatar: { endsWith: "/system/default_avatar.png" } },
      { avatar: { endsWith: "/system/default_avatar.jpg" } },
    ],
  };
}
