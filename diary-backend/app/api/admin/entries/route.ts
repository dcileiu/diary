import { DiaryEntryStatus, type Prisma } from "@prisma/client";

import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { DIARY_STATUS_LABEL_MAP } from "@/lib/diary-constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeStatus(value: string | null) {
  const raw = String(value ?? "").trim().toUpperCase();
  const allowed = Object.values(DiaryEntryStatus);
  return allowed.includes(raw as DiaryEntryStatus)
    ? (raw as DiaryEntryStatus)
    : null;
}

export async function GET(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 12));
  const status = normalizeStatus(url.searchParams.get("status"));
  const categoryId = Number(url.searchParams.get("categoryId") || 0) || 0;
  const keyword = String(url.searchParams.get("keyword") || "").trim();

  const where: Prisma.DiaryEntryWhereInput = {
    ...(status ? { status } : {}),
    ...(categoryId > 0 ? { categoryId } : {}),
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
        user: {
          select: { id: true, nickname: true },
        },
        category: true,
        tags: {
          include: { tag: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ isPinned: "desc" }, { happenedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
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
}
