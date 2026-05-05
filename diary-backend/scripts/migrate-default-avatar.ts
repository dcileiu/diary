/**
 * Keeps wx_user.avatar up to date:
 * 1) old default avatar values -> current CDN default avatar URL
 * 2) same-site http avatar URLs -> https
 *
 * Usage from wallpaper-backend:
 *   PUBLIC_SITE_ORIGIN=https://your-domain
 *   npx tsx scripts/migrate-default-avatar.ts
 *   npx tsx scripts/migrate-default-avatar.ts --dry-run
 *
 * Login also performs the same repair for matching legacy default avatars.
 */
import path from "path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { prismaWhereLegacyDefaultAvatars } from "../lib/default-avatar-legacy";
import { upgradeSameHostAvatarHttpToHttps } from "../lib/local-upload";
import { MINI_PROGRAM_DEFAULT_AVATAR_URL } from "../lib/wx-user-defaults";

const root = path.join(__dirname, "..");
loadEnvConfig(root, false, console, true);

const prisma = new PrismaClient();

function parsePublicSiteUrl(originRaw: string): URL {
  const origin = originRaw.trim().replace(/\/$/, "");
  const raw = /^https?:\/\//i.test(origin) ? origin : `https://${origin}`;
  return new URL(raw);
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const originEnv = process.env.PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (!originEnv) {
    console.error(
      "Missing PUBLIC_SITE_ORIGIN, for example: https://wallpaper.api.itianci.cn",
    );
    process.exit(1);
  }

  let siteUrl: URL;
  try {
    siteUrl = parsePublicSiteUrl(originEnv);
  } catch {
    console.error("PUBLIC_SITE_ORIGIN is not a valid URL");
    process.exit(1);
  }

  const canonicalDefault = MINI_PROGRAM_DEFAULT_AVATAR_URL;
  const whereLegacy = prismaWhereLegacyDefaultAvatars(siteUrl.origin);

  const count1 = await prisma.wxUser.count({ where: whereLegacy });
  console.log(`[1] legacy default avatar -> new CDN avatar: ${count1} rows`);
  console.log(`    target: ${canonicalDefault}`);
  if (dry && count1 > 0) {
    const sample = await prisma.wxUser.findMany({
      where: whereLegacy,
      take: 5,
      select: { id: true, avatar: true },
    });
    console.log("    sample:", sample);
  }
  if (!dry && count1 > 0) {
    const result = await prisma.wxUser.updateMany({
      where: whereLegacy,
      data: { avatar: canonicalDefault },
    });
    console.log(`    updated: ${result.count}`);
  }

  const httpPrefix = `http://${siteUrl.host}`;
  const httpRows = await prisma.wxUser.findMany({
    where: { avatar: { startsWith: httpPrefix } },
    select: { id: true, avatar: true },
  });
  console.log(
    `[2] same-site http avatar -> https: ${httpRows.length} rows (${httpPrefix}...)`,
  );
  if (dry && httpRows.length > 0) {
    console.log("    sample:", httpRows.slice(0, 5));
  }
  if (!dry && httpRows.length > 0) {
    let updated = 0;
    for (const row of httpRows) {
      const next = upgradeSameHostAvatarHttpToHttps(
        row.avatar,
        siteUrl.origin,
      );
      if (next && next !== row.avatar) {
        await prisma.wxUser.update({
          where: { id: row.id },
          data: { avatar: next },
        });
        updated += 1;
      }
    }
    console.log(`    updated: ${updated}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
