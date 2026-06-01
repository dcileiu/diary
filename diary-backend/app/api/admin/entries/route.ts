import { type Prisma } from "@prisma/client";

import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { DIARY_STATUS_LABEL_MAP } from "@/lib/diary-constants";
import { normalizeStatusOrNull } from "@/lib/diary-status";
import { prisma } from "@/lib/prisma";
import { asText, parsePagination, positiveInt } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAdmin("admin/entries", async (req) => {
  const url = new URL(req.url);
  const { page, pageSize: limit, skip, take } = parsePagination(
    url.searchParams.get("page"),
    url.searchParams.get("limit"),
    { defaultPageSize: 12, maxPageSize: 50 },
  );
  const status = normalizeStatusOrNull(url.searchParams.get("status"));
  const categoryId = positiveInt(url.searchParams.get("categoryId"));
  const keyword = asText(url.searchParams.get("keyword"));

  const where: Prisma.DiaryEntryWhereInput = {
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(keyword
      ? {
          OR: [
            { title: { contains: keyword } },
            { content: { contains: keyword } },
            { targetName: { contains: keyword } },
            { user: { nickname: { contains: keyword } } },
          ],
        }
      : {}),
  };

  const [total, list] = await Promise.all([
    prisma.diaryEntry.count({ where }),
    prisma.diaryEntry.findMany({
      where,
      include: {
        user: { select: { id: true, nickname: true } },
        category: true,
        tags: { include: { tag: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ isPinned: "desc" }, { happenedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
  ]);

  return adminJson({
    code: 0,
    data: {
      page,
      limit,
      total,
      list: list.map((item) => ({
        id: item.id,
        title: item.title,
        contentPreview:
          item.content.length > 90 ? `${item.content.slice(0, 90)}...` : item.content,
        user: item.user,
        category: item.category
          ? {
              id: item.category.id,
              name: item.category.name,
              color: item.category.color,
            }
          : null,
        tags: item.tags.map((row) => ({
          id: row.tag.id,
          name: row.tag.name,
          color: row.tag.color,
        })),
        status: item.status,
        statusLabel: DIARY_STATUS_LABEL_MAP[item.status] ?? item.status,
        grievanceLevel: item.grievanceLevel,
        emotionLevel: item.emotionLevel,
        followUpCount: item.followUpCount,
        isPinned: item.isPinned,
        happenedAt: item.happenedAt.toISOString(),
        lastFollowUpAt: item.lastFollowUpAt?.toISOString() ?? "",
        createdAt: item.createdAt.toISOString(),
      })),
    },
  });
});
