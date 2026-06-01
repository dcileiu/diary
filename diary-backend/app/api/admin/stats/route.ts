import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { RESOLVED_STATUSES, UNRESOLVED_STATUSES } from "@/lib/diary-status";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAdmin("admin/stats", async () => {
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
      where: { status: { in: [...UNRESOLVED_STATUSES] } },
    }),
    prisma.diaryEntry.count({
      where: { status: { in: [...RESOLVED_STATUSES] } },
    }),
    prisma.diaryEntryFollowUp.count(),
    prisma.diaryCategory.count(),
    prisma.diaryTag.count(),
    prisma.diaryEntry.count({ where: { createdAt: { gte: todayStart } } }),
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
});
