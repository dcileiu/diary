import { Prisma, type WxUser } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  DIARY_FOLLOW_UP_LABEL_MAP,
  DIARY_FOLLOW_UP_TYPE_OPTIONS,
  DIARY_STATUS_LABEL_MAP,
  DIARY_ENTRY_STATUS_OPTIONS,
} from "@/lib/diary-constants";
import {
  DiaryEntryStatus,
  DiaryFollowUpType,
  isResolvedStatus,
  normalizeFollowUpType,
  normalizeStatus,
  normalizeStatusOrNull,
} from "@/lib/diary-status";
import { absoluteAssetUrl } from "@/lib/public-origin";
import { prisma } from "@/lib/prisma";
import {
  asText,
  clampInt,
  clampLevel,
  normalizeIdList,
  parseDateInput,
  parsePagination,
  positiveInt,
} from "@/lib/validation";
import {
  defaultMiniProgramNickname,
  MINI_PROGRAM_DEFAULT_AVATAR_PATH,
} from "@/lib/wx-user-defaults";

type DiaryDbClient = Prisma.TransactionClient | typeof prisma;

const listInclude = {
  category: true,
  tags: {
    include: { tag: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.DiaryEntryInclude;

const detailInclude = {
  category: true,
  tags: {
    include: { tag: true },
    orderBy: { createdAt: "asc" as const },
  },
  attachments: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  followUps: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
} satisfies Prisma.DiaryEntryInclude;

type DiaryListEntry = Prisma.DiaryEntryGetPayload<{
  include: typeof listInclude;
}>;

type DiaryDetailEntry = Prisma.DiaryEntryGetPayload<{
  include: typeof detailInclude;
}>;

export class DiaryInputError extends Error {
  override name = "DiaryInputError";
}

export class DiaryNotFoundError extends Error {
  override name = "DiaryNotFoundError";
}

function previewContent(content: string) {
  if (content.length <= 72) return content;
  return `${content.slice(0, 72)}...`;
}

function serializeCategory(
  category:
    | { id: number; name: string; color: string; description?: string | null }
    | null
    | undefined,
) {
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    description: category.description ?? "",
  };
}

function serializeTags(
  rows: Array<{ tag: { id: number; name: string; color: string } }>,
) {
  return rows.map((row) => ({
    id: row.tag.id,
    name: row.tag.name,
    color: row.tag.color,
  }));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}

function monthStartFromInput(value: unknown) {
  const raw = asText(value);
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [yearText, monthText] = raw.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (year >= 2000 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(date: Date) {
  return formatDateKey(date).slice(0, 7);
}

export function serializeDiaryUser(user: WxUser) {
  return {
    id: user.id,
    accessToken: user.accessToken,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
    totalEntryCount: user.totalEntryCount,
    activeEntryCount: user.activeEntryCount,
    resolvedEntryCount: user.resolvedEntryCount,
    lastEntryAt: user.lastEntryAt?.toISOString() ?? "",
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeDiaryEntryList(entry: DiaryListEntry) {
  return {
    id: entry.id,
    title: entry.title,
    contentPreview: previewContent(entry.content),
    targetName: entry.targetName,
    targetRelation: entry.targetRelation,
    location: entry.location,
    grievanceLevel: entry.grievanceLevel,
    emotionLevel: entry.emotionLevel,
    followUpCount: entry.followUpCount,
    status: entry.status,
    statusLabel: DIARY_STATUS_LABEL_MAP[entry.status] ?? entry.status,
    isPinned: entry.isPinned,
    happenedAt: entry.happenedAt.toISOString(),
    settledAt: entry.settledAt?.toISOString() ?? "",
    lastFollowUpAt: entry.lastFollowUpAt?.toISOString() ?? "",
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    category: serializeCategory(entry.category),
    tags: serializeTags(entry.tags),
  };
}

export function serializeDiaryEntryDetail(entry: DiaryDetailEntry) {
  return {
    ...serializeDiaryEntryList(entry),
    content: entry.content,
    attachments: entry.attachments.map((item) => ({
      id: item.id,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      fileType: item.fileType,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
    })),
    followUps: entry.followUps.map((item) => ({
      id: item.id,
      type: item.type,
      typeLabel: DIARY_FOLLOW_UP_LABEL_MAP[item.type] ?? item.type,
      content: item.content,
      emotionDelta: item.emotionDelta,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export async function resolveDiaryUserFromRequest(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return prisma.wxUser.findUnique({ where: { accessToken: token } });
}

export async function loginOrRegisterDiaryUser(openId: string, req: Request) {
  const defaultAvatar = absoluteAssetUrl(req, MINI_PROGRAM_DEFAULT_AVATAR_PATH);
  const existing = await prisma.wxUser.findUnique({ where: { openId } });
  if (existing) {
    if (!existing.nickname || !existing.avatar || !existing.accessToken) {
      const updated = await prisma.wxUser.update({
        where: { id: existing.id },
        data: {
          nickname: existing.nickname || defaultMiniProgramNickname(),
          avatar: existing.avatar || defaultAvatar,
          accessToken: existing.accessToken || randomUUID().replace(/-/g, ""),
        },
      });
      return serializeDiaryUser(updated);
    }
    return serializeDiaryUser(existing);
  }

  const created = await prisma.wxUser.create({
    data: {
      openId,
      accessToken: randomUUID().replace(/-/g, ""),
      nickname: defaultMiniProgramNickname(),
      avatar: defaultAvatar,
    },
  });
  return serializeDiaryUser(created);
}

export async function listDiaryMeta() {
  const [categories, tags] = await Promise.all([
    prisma.diaryCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.diaryTag.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  return {
    categories: categories.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      color: item.color,
      sortOrder: item.sortOrder,
    })),
    tags: tags.map((item) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      sortOrder: item.sortOrder,
    })),
    statusOptions: DIARY_ENTRY_STATUS_OPTIONS,
    followUpTypeOptions: DIARY_FOLLOW_UP_TYPE_OPTIONS,
  };
}

export async function getDiaryBootstrap(userId: number) {
  const [user, todayCount, weekCount, grouped, recentEntries] = await Promise.all([
    prisma.wxUser.findUniqueOrThrow({ where: { id: userId } }),
    prisma.diaryEntry.count({
      where: {
        userId,
        happenedAt: { gte: startOfToday() },
      },
    }),
    prisma.diaryEntry.count({
      where: {
        userId,
        happenedAt: { gte: startOfWeek() },
      },
    }),
    prisma.diaryEntry.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId },
      include: listInclude,
      orderBy: [{ isPinned: "desc" }, { happenedAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);

  const statusBreakdown = Object.fromEntries(
    DIARY_ENTRY_STATUS_OPTIONS.map((item) => [item.value, 0]),
  ) as Record<string, number>;
  grouped.forEach((item) => {
    statusBreakdown[item.status] = item._count._all;
  });

  return {
    user: serializeDiaryUser(user),
    summary: {
      totalEntryCount: user.totalEntryCount,
      activeEntryCount: user.activeEntryCount,
      resolvedEntryCount: user.resolvedEntryCount,
      todayCount,
      thisWeekCount: weekCount,
    },
    statusBreakdown,
    recentEntries: recentEntries.map(serializeDiaryEntryList),
  };
}

export async function getDiaryCalendar(
  userId: number,
  input: {
    month?: unknown;
    selectedDate?: unknown;
  },
) {
  const monthStart = monthStartFromInput(input.month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const monthKey = formatMonthKey(monthStart);
  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId,
      happenedAt: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
    orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      targetName: true,
      grievanceLevel: true,
      emotionLevel: true,
      status: true,
      happenedAt: true,
      followUpCount: true,
    },
  });

  const markerMap: Record<
    string,
    {
      date: string;
      entryCount: number;
      grievanceLevel: number;
      unresolved: boolean;
    }
  > = {};
  const unresolvedStatuses = new Set<string>([
    DiaryEntryStatus.OPEN,
    DiaryEntryStatus.COOLING,
  ]);
  let followUpTotal = 0;
  const targetSet = new Set<string>();
  let resolvedCount = 0;

  entries.forEach((entry) => {
    const key = formatDateKey(entry.happenedAt);
    const current = markerMap[key] || {
      date: key,
      entryCount: 0,
      grievanceLevel: 0,
      unresolved: false,
    };
    current.entryCount += 1;
    current.grievanceLevel = Math.max(current.grievanceLevel, entry.grievanceLevel);
    current.unresolved = current.unresolved || unresolvedStatuses.has(entry.status);
    markerMap[key] = current;

    followUpTotal += entry.followUpCount;
    if (entry.targetName) targetSet.add(entry.targetName);
    if (isResolvedStatus(entry.status)) resolvedCount += 1;
  });

  const requestedDate = asText(input.selectedDate);
  const validRequestedDate =
    requestedDate && requestedDate.startsWith(monthKey) ? requestedDate : "";
  const todayKey = formatDateKey(new Date());
  const fallbackDate =
    validRequestedDate ||
    (todayKey.startsWith(monthKey) ? todayKey : "") ||
    (entries[0] ? formatDateKey(entries[0].happenedAt) : `${monthKey}-01`);

  const selectedEntry = entries.find(
    (entry) => formatDateKey(entry.happenedAt) === fallbackDate,
  );

  return {
    month: monthKey,
    selectedDate: fallbackDate,
    markers: Object.values(markerMap),
    selectedEntry: selectedEntry
      ? {
          id: selectedEntry.id,
          title: selectedEntry.title,
          contentPreview: previewContent(selectedEntry.content),
          grievanceLevel: selectedEntry.grievanceLevel,
          emotionLevel: selectedEntry.emotionLevel,
          targetName: selectedEntry.targetName,
          status: selectedEntry.status,
          statusLabel:
            DIARY_STATUS_LABEL_MAP[selectedEntry.status] ?? selectedEntry.status,
          happenedAt: selectedEntry.happenedAt.toISOString(),
        }
      : null,
    summary: {
      totalEntries: entries.length,
      resolvedRate: entries.length ? Math.round((resolvedCount / entries.length) * 100) : 0,
      targetCount: targetSet.size,
      followUpCount: followUpTotal,
    },
  };
}

export async function getDiaryStats(
  userId: number,
  input: {
    month?: unknown;
  },
) {
  const monthStart = monthStartFromInput(input.month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const prevMonthEnd = monthStart;

  const [entries, prevCount] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: {
        userId,
        happenedAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
      select: {
        grievanceLevel: true,
        targetName: true,
      },
    }),
    prisma.diaryEntry.count({
      where: {
        userId,
        happenedAt: {
          gte: prevMonthStart,
          lt: prevMonthEnd,
        },
      },
    }),
  ]);

  const total = entries.length;
  const buckets = [
    { key: "critical", label: "气炸了", color: "#F78AA0", count: 0 },
    { key: "high", label: "很生气", color: "#F6C35B", count: 0 },
    { key: "mid", label: "有点生气", color: "#B7A4FF", count: 0 },
    { key: "low", label: "一点点生气", color: "#C7DB9E", count: 0 },
  ];
  const targetCounter: Record<string, number> = {};

  entries.forEach((entry) => {
    if (entry.grievanceLevel >= 5) buckets[0].count += 1;
    else if (entry.grievanceLevel === 4) buckets[1].count += 1;
    else if (entry.grievanceLevel === 3) buckets[2].count += 1;
    else buckets[3].count += 1;

    const key = entry.targetName || "未填写对象";
    targetCounter[key] = (targetCounter[key] || 0) + 1;
  });

  const distribution = buckets.map((item) => ({
    ...item,
    percent: total ? Math.round((item.count / total) * 100) : 0,
  }));
  const maxTargetCount = Math.max(
    1,
    ...Object.values(targetCounter).map((count) => Number(count) || 0),
  );
  const topTargets = Object.keys(targetCounter)
    .map((name) => ({
      name,
      count: targetCounter[name],
      percent: Math.round(((targetCounter[name] || 0) / maxTargetCount) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    month: formatMonthKey(monthStart),
    totalCount: total,
    deltaFromPrevMonth: total - prevCount,
    distribution,
    topTargets,
  };
}

export async function listDiaryEntriesForUser(
  userId: number,
  input: {
    page?: unknown;
    pageSize?: unknown;
    status?: unknown;
    statusGroup?: unknown;
    categoryId?: unknown;
    keyword?: unknown;
  },
) {
  const { page, pageSize, skip, take } = parsePagination(
    input.page,
    input.pageSize,
    { defaultPageSize: 10, maxPageSize: 30 },
  );
  const status = normalizeStatusOrNull(input.status);
  const statusGroup = asText(input.statusGroup).toUpperCase();
  const categoryId = positiveInt(input.categoryId);
  const keyword = asText(input.keyword);

  const where: Prisma.DiaryEntryWhereInput = {
    userId,
    ...(status ? { status } : {}),
    ...(statusGroup === "UNRESOLVED"
      ? {
          status: { in: [DiaryEntryStatus.OPEN, DiaryEntryStatus.COOLING] },
        }
      : {}),
    ...(statusGroup === "RESOLVED"
      ? {
          status: {
            in: [
              DiaryEntryStatus.RECONCILED,
              DiaryEntryStatus.RELEASED,
              DiaryEntryStatus.ARCHIVED,
            ],
          },
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(keyword
      ? {
          OR: [
            { title: { contains: keyword } },
            { content: { contains: keyword } },
            { targetName: { contains: keyword } },
          ],
        }
      : {}),
  };

  const [total, list] = await Promise.all([
    prisma.diaryEntry.count({ where }),
    prisma.diaryEntry.findMany({
      where,
      include: listInclude,
      orderBy: [{ isPinned: "desc" }, { happenedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    list: list.map(serializeDiaryEntryList),
  };
}

export async function getDiaryEntryDetailForUser(userId: number, entryId: number) {
  const entry = await prisma.diaryEntry.findFirst({
    where: { id: entryId, userId },
    include: detailInclude,
  });
  if (!entry) throw new DiaryNotFoundError("条目不存在");
  return serializeDiaryEntryDetail(entry);
}

export async function saveDiaryEntryForUser(
  userId: number,
  input: {
    id?: unknown;
    categoryId?: unknown;
    title?: unknown;
    content?: unknown;
    targetName?: unknown;
    targetRelation?: unknown;
    location?: unknown;
    grievanceLevel?: unknown;
    emotionLevel?: unknown;
    status?: unknown;
    isPinned?: unknown;
    happenedAt?: unknown;
    tagIds?: unknown;
    initialFollowUp?: unknown;
  },
) {
  const entryId = positiveInt(input.id);
  const title = asText(input.title);
  const content = asText(input.content);
  if (!title) throw new DiaryInputError("标题不能为空");
  if (!content) throw new DiaryInputError("内容不能为空");

  const categoryId = positiveInt(input.categoryId);
  // 只有显式传入合法日期时才更新发生时间；编辑时若未传，保持原值而不是重置为当前时间。
  const parsedHappenedAt = parseDateInput(input.happenedAt);
  const grievanceLevel = clampLevel(input.grievanceLevel);
  const emotionLevel = clampLevel(input.emotionLevel);
  const status = normalizeStatus(input.status);
  const tagIds = normalizeIdList(input.tagIds);
  const initialFollowUp = asText(input.initialFollowUp);

  return prisma.$transaction(async (tx) => {
    const safeCategoryId = categoryId
      ? (
          await tx.diaryCategory.findUnique({
            where: { id: categoryId },
            select: { id: true },
          })
        )?.id ?? null
      : null;
    const validTagIds = tagIds.length
      ? (
          await tx.diaryTag.findMany({
            where: { id: { in: tagIds } },
            select: { id: true },
          })
        ).map((item) => item.id)
      : [];

    const baseData = {
      userId,
      categoryId: safeCategoryId,
      title,
      content,
      targetName: asText(input.targetName),
      targetRelation: asText(input.targetRelation),
      location: asText(input.location),
      grievanceLevel,
      emotionLevel,
      status,
      isPinned: Boolean(input.isPinned),
      settledAt: isResolvedStatus(status) ? new Date() : null,
    };

    let savedId: number;
    if (entryId) {
      const current = await tx.diaryEntry.findFirst({
        where: { id: entryId, userId },
        select: { id: true, followUpCount: true, lastFollowUpAt: true },
      });
      if (!current) throw new DiaryNotFoundError("条目不存在");
      await tx.diaryEntry.update({
        where: { id: entryId },
        data: {
          ...baseData,
          ...(parsedHappenedAt ? { happenedAt: parsedHappenedAt } : {}),
          followUpCount: current.followUpCount,
          lastFollowUpAt: current.lastFollowUpAt,
        },
      });
      savedId = entryId;
      await tx.diaryEntryTag.deleteMany({ where: { entryId } });
    } else {
      const created = await tx.diaryEntry.create({
        data: { ...baseData, happenedAt: parsedHappenedAt ?? new Date() },
      });
      savedId = created.id;
    }

    if (validTagIds.length) {
      // 注意：SQLite 下 Prisma createMany 不支持 skipDuplicates。
      // 这里 validTagIds 已去重，且新建无既有标签、编辑前已 deleteMany 清空，
      // 配合 @@unique([entryId, tagId]) 不会产生重复，无需该选项。
      await tx.diaryEntryTag.createMany({
        data: validTagIds.map((tagId) => ({
          entryId: savedId,
          tagId,
        })),
      });
    }

    if (initialFollowUp) {
      await tx.diaryEntryFollowUp.create({
        data: {
          entryId: savedId,
          userId,
          type: DiaryFollowUpType.NOTE,
          content: initialFollowUp,
          emotionDelta: 0,
        },
      });
      const followUpCount = await tx.diaryEntryFollowUp.count({
        where: { entryId: savedId },
      });
      await tx.diaryEntry.update({
        where: { id: savedId },
        data: {
          followUpCount,
          lastFollowUpAt: new Date(),
        },
      });
    }

    await refreshUserDiaryStats(tx, userId);
    const detail = await tx.diaryEntry.findUnique({
      where: { id: savedId },
      include: detailInclude,
    });
    if (!detail) throw new DiaryNotFoundError("条目不存在");
    return serializeDiaryEntryDetail(detail);
  });
}

export async function updateDiaryEntryStatusForUser(
  userId: number,
  entryId: number,
  statusInput: unknown,
) {
  const status = normalizeStatus(statusInput);
  return prisma.$transaction(async (tx) => {
    const entry = await tx.diaryEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true },
    });
    if (!entry) throw new DiaryNotFoundError("条目不存在");

    await tx.diaryEntry.update({
      where: { id: entryId },
      data: {
        status,
        settledAt: isResolvedStatus(status) ? new Date() : null,
      },
    });

    await refreshUserDiaryStats(tx, userId);
    const detail = await tx.diaryEntry.findUnique({
      where: { id: entryId },
      include: detailInclude,
    });
    if (!detail) throw new DiaryNotFoundError("条目不存在");
    return serializeDiaryEntryDetail(detail);
  });
}

export async function addDiaryFollowUpForUser(
  userId: number,
  input: {
    entryId?: unknown;
    type?: unknown;
    content?: unknown;
    emotionDelta?: unknown;
  },
) {
  const entryId = positiveInt(input.entryId);
  if (!entryId) throw new DiaryInputError("缺少条目 ID");
  const content = asText(input.content);
  if (!content) throw new DiaryInputError("跟进内容不能为空");
  const type = normalizeFollowUpType(input.type);
  const delta = clampInt(input.emotionDelta, -2, 2, 0);

  return prisma.$transaction(async (tx) => {
    const current = await tx.diaryEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, emotionLevel: true, followUpCount: true },
    });
    if (!current) throw new DiaryNotFoundError("条目不存在");

    const nextEmotion = Math.max(1, Math.min(5, current.emotionLevel + delta));

    await tx.diaryEntryFollowUp.create({
      data: {
        entryId,
        userId,
        type,
        content,
        emotionDelta: delta,
      },
    });

    await tx.diaryEntry.update({
      where: { id: entryId },
      data: {
        emotionLevel: nextEmotion,
        followUpCount: current.followUpCount + 1,
        lastFollowUpAt: new Date(),
      },
    });

    const detail = await tx.diaryEntry.findUnique({
      where: { id: entryId },
      include: detailInclude,
    });
    if (!detail) throw new DiaryNotFoundError("条目不存在");
    return serializeDiaryEntryDetail(detail);
  });
}

export async function refreshUserDiaryStats(db: DiaryDbClient, userId: number) {
  const [total, active, resolved, latest] = await Promise.all([
    db.diaryEntry.count({ where: { userId } }),
    db.diaryEntry.count({
      where: {
        userId,
        status: { in: [DiaryEntryStatus.OPEN, DiaryEntryStatus.COOLING] },
      },
    }),
    db.diaryEntry.count({
      where: {
        userId,
        status: {
          in: [
            DiaryEntryStatus.RECONCILED,
            DiaryEntryStatus.RELEASED,
            DiaryEntryStatus.ARCHIVED,
          ],
        },
      },
    }),
    db.diaryEntry.findFirst({
      where: { userId },
      orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
      select: { happenedAt: true },
    }),
  ]);

  await db.wxUser.update({
    where: { id: userId },
    data: {
      totalEntryCount: total,
      activeEntryCount: active,
      resolvedEntryCount: resolved,
      lastEntryAt: latest?.happenedAt ?? null,
    },
  });
}
