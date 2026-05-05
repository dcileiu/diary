import { DiaryEntryStatus } from "@prisma/client";

import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    userCount,
    entryCount,
    openEntryCount,
    resolvedEntryCount,
    followUpCount,
    categoryCount,
    tagCount,
    todayEntryCount,
  ] = await Promise.all([
    prisma.wxUser.count(),
    prisma.diaryEntry.count(),
    prisma.diaryEntry.count({
      where: {
        status: { in: [DiaryEntryStatus.OPEN, DiaryEntryStatus.COOLING] },
      },
    }),
    prisma.diaryEntry.count({
      where: {
        status: {
          in: [
            DiaryEntryStatus.RECONCILED,
            DiaryEntryStatus.RELEASED,
            DiaryEntryStatus.ARCHIVED,
          ],
        },
      },
    }),
    prisma.diaryEntryFollowUp.count(),
    prisma.diaryCategory.count(),
    prisma.diaryTag.count(),
    prisma.diaryEntry.count({
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return adminJson({
    code: 0,
    data: {
      userCount,
      entryCount,
      openEntryCount,
      resolvedEntryCount,
      followUpCount,
      categoryCount,
      tagCount,
      todayEntryCount,
    },
  });
}
