import {
  WALLPAPER_MEDIA_EXTRACT_POINTS_COST,
  type AdminUserSummary,
  type WallItem,
  type WallpaperCategory,
  type WallpaperTag,
  type WxUser,
  WALLPAPER_DOWNLOAD_POINTS_COST,
} from "@/lib/wallpaper-types";
import { prisma } from "@/lib/prisma";
import { isLegacyDefaultAvatarUrl } from "@/lib/default-avatar-legacy";
import { upgradeSameHostAvatarHttpToHttps } from "@/lib/local-upload";
import {
  defaultMiniProgramNickname,
  MINI_PROGRAM_DEFAULT_AVATAR_URL,
} from "@/lib/wx-user-defaults";
import { Prisma } from "@prisma/client";
import { chinaDayRangeUtc } from "@/lib/china-calendar-day";

function tokenFor(uid: string) {
  return `tk_${uid}_${Math.random().toString(36).slice(2, 12)}`;
}

function parseUserId(uid: string): number | null {
  const n = Number(uid);
  if (!Number.isFinite(n) || n <= 0) return null;
  const i = Math.floor(n);
  return i === n ? i : null;
}

function splitTypeTokens(input: string | null | undefined): string[] {
  if (!input) return [];
  return String(input)
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasTypeToken(typeField: string | null | undefined, typeName: string): boolean {
  const t = String(typeName || "").trim();
  if (!t) return false;
  return splitTypeTokens(typeField).includes(t);
}

function toWallItem(row: {
  id: number;
  groupCode: string;
  fileName: string;
  type: string;
  theme: string;
  title: string;
  tags: string;
  hotScore: number;
  collectCount: number;
  downloading: number;
  avatarList: Prisma.JsonValue | null;
  dailyFeatured: boolean;
  dailyFeaturedSort: number;
  hidden: boolean;
}): WallItem {
  const raw = row.avatarList;
  const avatarList = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    wallpapersId: row.id,
    groupCode: row.groupCode,
    fileName: row.fileName,
    type: row.type,
    theme: row.theme || undefined,
    title: row.title,
    tags: row.tags,
    hotScore: row.hotScore,
    collectCount: row.collectCount,
    downloading: row.downloading,
    avatarList: avatarList?.length ? avatarList : [],
    dailyFeatured: row.dailyFeatured,
    dailyFeaturedSort: row.dailyFeaturedSort,
    hidden: row.hidden,
  };
}

function toWxUser(u: {
  id: number;
  openId: string;
  accessToken: string;
  nickname: string;
  avatar: string;
  color: string;
  points: number;
  isVip: string;
}): WxUser {
  return {
    id: String(u.id),
    openId: u.openId,
    accessToken: u.accessToken,
    nickname: u.nickname,
    avatar: u.avatar,
    color: u.color,
    points: u.points,
    isVip: u.isVip,
  };
}

function toAdminUserSummary(u: {
  id: number;
  nickname: string;
  avatar: string;
  color: string;
  points: number;
  isVip: string;
}): AdminUserSummary {
  return {
    id: String(u.id),
    nickname: u.nickname,
    avatar: u.avatar,
    color: u.color,
    points: u.points,
    isVip: u.isVip,
  };
}

function wallpaperCreateData(
  w: Omit<WallItem, "wallpapersId"> & { wallpapersId?: number },
): Prisma.WallpaperCreateInput {
  return {
    groupCode: w.groupCode,
    fileName: w.fileName,
    type: w.type,
    theme: w.theme ?? "",
    title: w.title,
    tags: w.tags,
    hotScore: w.hotScore ?? 0,
    downloading: w.downloading ?? 0,
    avatarList:
      w.avatarList && w.avatarList.length > 0 ? w.avatarList : Prisma.JsonNull,
    dailyFeatured: w.dailyFeatured ?? false,
    dailyFeaturedSort: w.dailyFeaturedSort ?? 0,
    hidden: w.hidden ?? false,
  };
}

export class DbWallpaperStore {
  async loginByOpenId(
    openId: string,
    options?: { defaultAvatarUrl?: string; inviterId?: string },
  ): Promise<WxUser> {
    const existing = await prisma.wxUser.findUnique({ where: { openId } });
    if (existing) {
      const newTok = tokenFor(String(existing.id));
      const canonical = options?.defaultAvatarUrl?.trim();

      let siteOrigin: string | undefined;
      if (canonical) {
        try {
          siteOrigin = new URL(canonical).origin;
        } catch {
          /* ignore */
        }
      }
      if (!siteOrigin) {
        const envO = process.env.PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
        if (envO) {
          try {
            siteOrigin = new URL(
              /^https?:\/\//i.test(envO) ? envO : `https://${envO}`,
            ).origin;
          } catch {
            /* ignore */
          }
        }
      }

      let avatarUpdate: string | undefined;
      if (
        canonical &&
        isLegacyDefaultAvatarUrl(existing.avatar, { siteOrigin })
      ) {
        avatarUpdate = canonical;
      } else if (siteOrigin) {
        const upgraded = upgradeSameHostAvatarHttpToHttps(
          existing.avatar,
          siteOrigin,
        );
        if (upgraded) avatarUpdate = upgraded;
      }

      const updated = await prisma.wxUser.update({
        where: { id: existing.id },
        data: {
          accessToken: newTok,
          ...(avatarUpdate ? { avatar: avatarUpdate } : {}),
        },
      });
      return toWxUser(updated);
    }
    const inviterNum = Number(options?.inviterId);
    const inviterId =
      Number.isFinite(inviterNum) && inviterNum > 0 ? Math.floor(inviterNum) : 0;
    const placeholder = `tk_pre_${Math.random().toString(36).slice(2, 14)}`;
    const final = await prisma.$transaction(async (tx) => {
      const created = await tx.wxUser.create({
        data: {
          openId,
          accessToken: placeholder,
          nickname: defaultMiniProgramNickname(),
          avatar: options?.defaultAvatarUrl ?? MINI_PROGRAM_DEFAULT_AVATAR_URL,
          color: "#22c55e",
          points: 2,
          isVip: "0",
        },
      });
      const updated = await tx.wxUser.update({
        where: { id: created.id },
        data: { accessToken: tokenFor(String(created.id)) },
      });

      /** 邀请奖励：仅当「新用户首次注册」时触发 */
      if (inviterId && inviterId !== created.id) {
        const inviter = await tx.wxUser.findUnique({ where: { id: inviterId } });
        if (inviter) {
          await tx.wxUser.update({
            where: { id: inviterId },
            data: { points: { increment: 15 } },
          });
          await tx.pointRecord.create({
            data: { userId: inviterId, content: "邀请", points: 15, type: "1" },
          });
        }
      }
      return updated;
    });

    return toWxUser(final);
  }

  async authUser(authorization: string | null): Promise<WxUser | null> {
    if (!authorization) return null;
    const tok = authorization.replace(/^Bearer\s+/i, "").trim();
    const u = await prisma.wxUser.findUnique({ where: { accessToken: tok } });
    return u ? toWxUser(u) : null;
  }

  async listWallpapers(): Promise<WallItem[]> {
    const rows = await prisma.wallpaper.findMany({ orderBy: { id: "desc" } });
    return rows.map(toWallItem);
  }

  /** 后台列表分页：按 id 倒序 */
  async listWallpapersPaged(
    page: number,
    limit: number,
  ): Promise<{ list: WallItem[]; total: number; page: number; limit: number }> {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const total = await prisma.wallpaper.count();
    const maxPage = Math.max(1, Math.ceil(total / safeLimit) || 1);
    const safePage = Math.min(maxPage, Math.max(1, Math.floor(page)));
    const rows = await prisma.wallpaper.findMany({
      orderBy: { id: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return {
      list: rows.map(toWallItem),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async upsertWallpaper(
    w: Omit<WallItem, "wallpapersId"> & { wallpapersId?: number },
  ): Promise<WallItem> {
    if (w.wallpapersId) {
      const exists = await prisma.wallpaper.findUnique({
        where: { id: w.wallpapersId },
      });
      if (exists) {
        const data: Prisma.WallpaperUpdateInput = {};
        if (w.groupCode !== undefined) data.groupCode = w.groupCode;
        if (w.fileName !== undefined) data.fileName = w.fileName;
        if (w.type !== undefined) data.type = w.type;
        if (w.theme !== undefined) data.theme = w.theme ?? "";
        if (w.title !== undefined) data.title = w.title;
        if (w.tags !== undefined) data.tags = w.tags;
        if (w.hotScore !== undefined) data.hotScore = w.hotScore;
        if (w.downloading !== undefined) data.downloading = w.downloading;
        if (w.avatarList !== undefined) {
          data.avatarList =
            w.avatarList.length > 0 ? w.avatarList : Prisma.JsonNull;
        }
        if (w.dailyFeatured !== undefined) data.dailyFeatured = w.dailyFeatured;
        if (w.dailyFeaturedSort !== undefined)
          data.dailyFeaturedSort = w.dailyFeaturedSort;
        if (w.hidden !== undefined) data.hidden = w.hidden;
        const row = await prisma.wallpaper.update({
          where: { id: w.wallpapersId },
          data,
        });
        return toWallItem(row);
      }
    }
    const row = await prisma.wallpaper.create({
      data: wallpaperCreateData(w),
    });
    return toWallItem(row);
  }

  async deleteWallpaper(id: number): Promise<void> {
    await prisma.wallpaper.deleteMany({ where: { id } });
  }

  async updateWallpaper(
    id: number,
    patch: Partial<WallItem>,
  ): Promise<WallItem | null> {
    const existing = await prisma.wallpaper.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Prisma.WallpaperUpdateInput = {};
    if (patch.groupCode !== undefined) data.groupCode = patch.groupCode;
    if (patch.fileName !== undefined) data.fileName = patch.fileName;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.theme !== undefined) data.theme = patch.theme ?? "";
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.tags !== undefined) data.tags = patch.tags;
    if (patch.hotScore !== undefined) data.hotScore = patch.hotScore;
    if (patch.downloading !== undefined) data.downloading = patch.downloading;
    if (patch.avatarList !== undefined) {
      data.avatarList =
        patch.avatarList.length > 0 ? patch.avatarList : Prisma.JsonNull;
    }

    if (
      patch.dailyFeatured !== undefined ||
      patch.dailyFeaturedSort !== undefined
    ) {
      let nf =
        patch.dailyFeatured !== undefined
          ? Boolean(patch.dailyFeatured)
          : existing.dailyFeatured;
      let ns =
        patch.dailyFeaturedSort !== undefined
          ? Math.max(
              0,
              Math.min(
                9999,
                Math.floor(Number(patch.dailyFeaturedSort)),
              ),
            )
          : existing.dailyFeaturedSort;
      if (patch.dailyFeatured === false) {
        nf = false;
        ns = 0;
      } else if (
        patch.dailyFeatured === true &&
        !existing.dailyFeatured &&
        patch.dailyFeaturedSort === undefined
      ) {
        const agg = await prisma.wallpaper.aggregate({
          where: { dailyFeatured: true, id: { not: id } },
          _max: { dailyFeaturedSort: true },
        });
        ns = (agg._max.dailyFeaturedSort ?? 0) + 1;
      }
      if (!nf) ns = 0;
      data.dailyFeatured = nf;
      data.dailyFeaturedSort = ns;
    }

    if (patch.hidden !== undefined) data.hidden = Boolean(patch.hidden);

    try {
      const row = await prisma.wallpaper.update({ where: { id }, data });
      return toWallItem(row);
    } catch {
      return null;
    }
  }

  async stats(): Promise<{
    wallpaperCount: number;
    userCount: number;
    collectionCount: number;
    downloadCount: number;
  }> {
    const [wallpaperCount, userCount, collectionCount, downloadCount] =
      await Promise.all([
      prisma.wallpaper.count(),
      prisma.wxUser.count(),
      prisma.userCollection.count(),
      prisma.userDownloadLog.count(),
    ]);
    return { wallpaperCount, userCount, collectionCount, downloadCount };
  }

  async pageQuery(params: {
    page: number;
    limit: number;
    selectFlag?: number | null;
    type?: string;
    tags?: string;
    groupCode?: string;
    theme?: string;
    search?: string;
  }): Promise<{ records: WallItem[]; total: number }> {
    const and: Prisma.WallpaperWhereInput[] = [{ hidden: false }];
    if (params.type) {
      const typeName = params.type.trim();
      if (typeName) and.push({ type: { contains: typeName } });
    }
    if (params.groupCode) {
      const g = params.groupCode.trim();
      if (g) and.push({ groupCode: g });
    }
    if (params.theme) {
      const t = params.theme.trim();
      if (t) and.push({ theme: { contains: t } });
    }
    if (params.tags) {
      const tagKeys = params.tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (tagKeys.length) {
        and.push({
          OR: tagKeys.map((k) => ({
            tags: { contains: k },
          })),
        });
      }
    }
    if (params.search) {
      const q = params.search.trim();
      if (q) {
        and.push({
          OR: [
            { theme: { contains: q } },
            { tags: { contains: q } },
          ],
        });
      }
    }
    const where: Prisma.WallpaperWhereInput =
      and.length === 1 ? and[0] : { AND: and };

    const page = Math.max(1, Math.floor(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit || 12)));
    const orderBy =
      params.selectFlag === 1
        ? [{ hotScore: "desc" as const }, { id: "desc" as const }]
        : [{ id: "desc" as const }];
    if (params.type && params.type.trim()) {
      const rows = await prisma.wallpaper.findMany({
        where,
        orderBy,
      });
      const filtered = rows.filter((r) => hasTypeToken(r.type, params.type!));
      const total = filtered.length;
      const pageRows = filtered.slice((page - 1) * limit, page * limit);
      return { records: pageRows.map(toWallItem), total };
    }

    const [total, rows] = await Promise.all([
      prisma.wallpaper.count({ where }),
      prisma.wallpaper.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { records: rows.map(toWallItem), total };
  }

  async indexData(): Promise<{
    phoneImages: WallItem[];
    swiperImages: WallItem[];
    scrollAvatars: WallItem[];
  }> {
    const [featuredRows, phoneRows, avatarRows, latestRows] = await Promise.all([
      prisma.wallpaper.findMany({
        where: { dailyFeatured: true, hidden: false },
        orderBy: [{ dailyFeaturedSort: "asc" }, { id: "desc" }],
        take: 12,
      }),
      prisma.wallpaper.findMany({
        where: { type: { contains: "手机壁纸" }, hidden: false },
        orderBy: { id: "desc" },
        take: 8,
      }),
      prisma.wallpaper.findMany({
        where: { type: { contains: "头像" }, hidden: false },
        orderBy: { id: "desc" },
        take: 12,
      }),
      prisma.wallpaper.findMany({
        where: { hidden: false },
        orderBy: { id: "desc" },
        take: 8,
      }),
    ]);

    const featured = featuredRows.map(toWallItem);
    const phone = phoneRows
      .filter((x) => hasTypeToken(x.type, "手机壁纸"))
      .map(toWallItem);
    const avatars = avatarRows
      .filter((x) => hasTypeToken(x.type, "头像"))
      .map(toWallItem);
    const latest = latestRows.map(toWallItem);

    const swiperImages = featured.length
      ? featured
      : phone.length
        ? phone.slice(0, 5)
        : latest.slice(0, 5);

    const phoneImages = phone.length ? phone : latest.slice(0, 8);
    const scrollAvatars = avatars.length ? avatars : latest.slice(0, 6);
    return {
      phoneImages,
      swiperImages,
      scrollAvatars,
    };
  }

  async ranking(num: number): Promise<WallItem[][]> {
    const sorted = await prisma.wallpaper.findMany({
      where: { hidden: false },
      orderBy: { hotScore: "desc" },
    });
    const items = sorted.map(toWallItem);
    const pick = () => items.slice(0, num);
    return [pick(), pick(), pick(), pick()];
  }

  async collectState(
    uid: string,
    ids: number[],
  ): Promise<{ wallpapersId: number }[]> {
    const uidNum = parseUserId(uid);
    if (!uidNum || !ids.length) return [];
    const rows = await prisma.userCollection.findMany({
      where: { userId: uidNum, wallpaperId: { in: ids } },
    });
    const set = new Set(rows.map((r) => r.wallpaperId));
    return ids
      .filter((id) => set.has(id))
      .map((wallpapersId) => ({ wallpapersId }));
  }

  async collectAdd(uid: string, wallpapersId: number): Promise<void> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.userCollection.create({
          data: { userId: uidNum, wallpaperId: wallpapersId },
        });
        await tx.wallpaper.update({
          where: { id: wallpapersId },
          data: { collectCount: { increment: 1 } },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return;
      }
      throw e;
    }
  }

  async collectCount(wallpapersId: number): Promise<number> {
    const wid = Number(wallpapersId);
    if (!Number.isFinite(wid) || wid < 1) return 0;
    const row = await prisma.wallpaper.findUnique({
      where: { id: wid },
      select: { collectCount: true },
    });
    if (!row) return 0;
    const n = Number(row.collectCount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async collectRemove(uid: string, wallpapersId: number): Promise<void> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return;
    await prisma.$transaction(async (tx) => {
      const res = await tx.userCollection.deleteMany({
        where: { userId: uidNum, wallpaperId: wallpapersId },
      });
      const dec = res.count || 0;
      if (dec <= 0) return;
      const cur = await tx.wallpaper.findUnique({
        where: { id: wallpapersId },
        select: { collectCount: true },
      });
      const next = Math.max(0, Number(cur?.collectCount ?? 0) - dec);
      await tx.wallpaper.update({
        where: { id: wallpapersId },
        data: { collectCount: next },
      });
    });
  }

  async collectForDate(
    uid: string,
    page: number,
    limit: number,
  ): Promise<{
    records: { date: string; serviceAccountActionVOList: WallItem[] }[];
    total: number;
  }> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return { records: [], total: 0 };
    const mine = await prisma.userCollection.findMany({
      where: { userId: uidNum },
      include: { wallpaper: true },
      orderBy: { createdAt: "desc" },
    });
    const byDay = new Map<string, WallItem[]>();
    for (const c of mine) {
      if (c.wallpaper.hidden) continue;
      const day = c.createdAt.toISOString().slice(0, 10);
      const w = toWallItem(c.wallpaper);
      const arr = byDay.get(day) ?? [];
      arr.push({ ...w });
      byDay.set(day, arr);
    }
    const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1));
    const total = days.length;
    const slice = days.slice((page - 1) * limit, (page - 1) * limit + limit);
    const records = slice.map((date) => ({
      date,
      serviceAccountActionVOList: byDay.get(date) ?? [],
    }));
    return { records, total };
  }

  /** 收藏列表扁平分页（按收藏时间倒序），供小程序瀑布流 */
  async collectPage(
    uid: string,
    page: number,
    limit: number,
  ): Promise<{ records: WallItem[]; total: number }> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return { records: [], total: 0 };
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const safePage = Math.max(1, Math.floor(page));
    const vis = { wallpaper: { hidden: false } as const };
    const total = await prisma.userCollection.count({
      where: { userId: uidNum, ...vis },
    });
    const rows = await prisma.userCollection.findMany({
      where: { userId: uidNum, ...vis },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: { wallpaper: true },
    });
    const records = rows
      .map((r) => r.wallpaper)
      .filter((w): w is NonNullable<typeof w> => w != null)
      .map(toWallItem);
    return { records, total };
  }

  async actionPage(
    uid: string,
    type: string,
    page: number,
    limit: number,
  ): Promise<{ records: WallItem[]; total: number }> {
    if (type !== "2") return { records: [], total: 0 };
    const uidNum = parseUserId(uid);
    if (!uidNum) return { records: [], total: 0 };
    const logs = await prisma.userDownloadLog.findMany({
      where: { userId: uidNum, wallpaper: { hidden: false } },
      orderBy: { createdAt: "desc" },
      include: { wallpaper: true },
    });
    const items: WallItem[] = [];
    for (const l of logs) {
      if (l.wallpaper && !l.wallpaper.hidden) items.push(toWallItem(l.wallpaper));
    }
    const start = (page - 1) * limit;
    const records = items.slice(start, start + limit);
    return { records, total: items.length };
  }

  async actionCount(
    uid: string,
  ): Promise<{ collectSum: number; downloadSum: number }> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return { collectSum: 0, downloadSum: 0 };
    const [collectSum, downloadSum] = await Promise.all([
      prisma.userCollection.count({
        where: { userId: uidNum, wallpaper: { hidden: false } },
      }),
      prisma.userDownloadLog.count({
        where: { userId: uidNum, wallpaper: { hidden: false } },
      }),
    ]);
    return { collectSum, downloadSum };
  }

  async logDownload(uid: string, wallpapersId: number): Promise<void> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return;
    const wallpaper = await prisma.wallpaper.findUnique({
      where: { id: wallpapersId },
      select: { id: true, hidden: true },
    });
    if (!wallpaper || wallpaper.hidden) return;
    await prisma.$transaction([
      prisma.userDownloadLog.create({
        data: { userId: uidNum, wallpaperId: wallpapersId },
      }),
      prisma.wallpaper.update({
        where: { id: wallpapersId },
        data: { downloading: { increment: 1 } },
      }),
    ]);
  }

  async completeDownload(
    uid: string,
    wallpapersId: number,
  ): Promise<{ user: WxUser } | { err: "发财鸭不足" | "壁纸不存在" } | null> {
    const userId = parseUserId(uid);
    if (!userId) return null;
    return prisma.$transaction(async (tx) => {
      const [user, wallpaper] = await Promise.all([
        tx.wxUser.findUnique({ where: { id: userId } }),
        tx.wallpaper.findUnique({
          where: { id: wallpapersId },
          select: { id: true, hidden: true },
        }),
      ]);
      if (!user) return null;
      if (!wallpaper || wallpaper.hidden) {
        return { err: "壁纸不存在" as const };
      }
      const existingLog = await tx.userDownloadLog.findFirst({
        where: { userId, wallpaperId: wallpapersId },
        select: { id: true },
      });
      if (existingLog) {
        return { user: toWxUser(user) };
      }
      if (
        user.isVip !== "2" &&
        user.points < WALLPAPER_DOWNLOAD_POINTS_COST
      ) {
        return { err: "发财鸭不足" as const };
      }
      let updated = user;
      if (user.isVip !== "2") {
        await tx.pointRecord.create({
          data: {
            userId,
            content: "下载扣减",
            points: -WALLPAPER_DOWNLOAD_POINTS_COST,
            type: "2",
          },
        });
        updated = await tx.wxUser.update({
          where: { id: userId },
          data: { points: { decrement: WALLPAPER_DOWNLOAD_POINTS_COST } },
        });
      }
      await tx.userDownloadLog.create({
        data: { userId, wallpaperId: wallpapersId },
      });
      await tx.wallpaper.update({
        where: { id: wallpapersId },
        data: { downloading: { increment: 1 } },
      });
      return { user: toWxUser(updated) };
    });
  }

  async points(
    uid: string,
    body: { type: string; operation?: string },
  ): Promise<
    { user: WxUser } | { err: "发财鸭不足" | "今日已签到" | "今日分享奖励已领取" } | null
  > {
    const userId = parseUserId(uid);
    if (!userId) return null;

    if (body.type === "2") {
      return prisma.$transaction(async (tx) => {
        const user = await tx.wxUser.findUnique({ where: { id: userId } });
        if (!user) return null;
        if (
          user.points < WALLPAPER_DOWNLOAD_POINTS_COST &&
          user.isVip !== "2"
        ) {
          return { err: "发财鸭不足" as const };
        }
        let nextPoints = user.points;
        if (user.isVip !== "2") {
          nextPoints -= WALLPAPER_DOWNLOAD_POINTS_COST;
          await tx.pointRecord.create({
            data: {
              userId,
              content: "下载扣减",
              points: -WALLPAPER_DOWNLOAD_POINTS_COST,
              type: "2",
            },
          });
        }
        const updated = await tx.wxUser.update({
          where: { id: userId },
          data: { points: nextPoints },
        });
        return { user: toWxUser(updated) };
      });
    }

    if (body.type === "3") {
      return prisma.$transaction(async (tx) => {
        const user = await tx.wxUser.findUnique({ where: { id: userId } });
        if (!user) return null;
        if (
          user.points < WALLPAPER_MEDIA_EXTRACT_POINTS_COST &&
          user.isVip !== "2"
        ) {
          return { err: "发财鸭不足" as const };
        }
        let nextPoints = user.points;
        if (user.isVip !== "2") {
          nextPoints -= WALLPAPER_MEDIA_EXTRACT_POINTS_COST;
          await tx.pointRecord.create({
            data: {
              userId,
              content: "去水印扣减",
              points: -WALLPAPER_MEDIA_EXTRACT_POINTS_COST,
              type: "2",
            },
          });
        }
        const updated = await tx.wxUser.update({
          where: { id: userId },
          data: { points: nextPoints },
        });
        return { user: toWxUser(updated) };
      });
    }

    if (body.type === "1") {
      const op = body.operation;
      let add = 0;
      let msg = "";
      if (op === "1") {
        add = 3;
        msg = "签到";
      } else if (op === "2") {
        add = 2;
        msg = "分享";
      } else if (op === "3") {
        add = 8;
        msg = "观看广告";
      }
      const { start, end } = chinaDayRangeUtc();
      return prisma.$transaction(async (tx) => {
        if (msg === "签到" || msg === "分享") {
          const dup = await tx.pointRecord.findFirst({
            where: {
              userId,
              content: msg,
              createdAt: { gte: start, lt: end },
            },
          });
          if (dup) {
            return {
              err:
                msg === "签到"
                  ? ("今日已签到" as const)
                  : ("今日分享奖励已领取" as const),
            };
          }
        }
        const updated = await tx.wxUser.update({
          where: { id: userId },
          data: { points: { increment: add } },
        });
        if (add) {
          await tx.pointRecord.create({
            data: { userId, content: msg, points: add, type: "1" },
          });
        }
        return { user: toWxUser(updated) };
      });
    }

    const user = await prisma.wxUser.findUnique({ where: { id: userId } });
    if (!user) return null;
    return { user: toWxUser(user) };
  }

  async pointRecordPage(
    uid: string,
    page: number,
    limit: number,
  ): Promise<{
    records: {
      content: string;
      points: number;
      type: string;
      createTime: string;
    }[];
    total: number;
  }> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return { records: [], total: 0 };
    const list = await prisma.pointRecord.findMany({
      where: { userId: uidNum },
      orderBy: { createdAt: "desc" },
    });
    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit);
    const records = slice.map((r) => ({
      content: r.content,
      points: r.points,
      type: r.type,
      createTime: r.createdAt.toISOString(),
    }));
    return { records, total: list.length };
  }

  async updateNickname(uid: string, nickname: string): Promise<WxUser | null> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return null;
    try {
      const u = await prisma.wxUser.update({
        where: { id: uidNum },
        data: { nickname },
      });
      return toWxUser(u);
    } catch {
      return null;
    }
  }

  async updateAvatar(uid: string, avatarUrl: string): Promise<WxUser | null> {
    const uidNum = parseUserId(uid);
    if (!uidNum) return null;
    try {
      const u = await prisma.wxUser.update({
        where: { id: uidNum },
        data: { avatar: avatarUrl },
      });
      return toWxUser(u);
    } catch {
      return null;
    }
  }

  async listUsersForAdmin(): Promise<AdminUserSummary[]> {
    const users = await prisma.wxUser.findMany({ orderBy: { id: "asc" } });
    if (!users.length) return [];
    const counts = await Promise.all(
      users.map(async (u) => ({
        id: u.id,
        ...(await this.actionCount(String(u.id))),
      })),
    );
    const countMap = new Map(
      counts.map((item) => [item.id, item] as const),
    );

    return users.map((u) => {
      const base = toAdminUserSummary(u);
      const stat = countMap.get(u.id);
      return {
        ...base,
        collectSum: stat ? stat.collectSum : 0,
        downloadSum: stat ? stat.downloadSum : 0,
      };
    });
  }

  /** 从已保存记录的壁纸的 tags 字段拆出的独立标签（不含预设，由接口层合并） */
  async listDistinctWallpaperTagTokens(): Promise<string[]> {
    const rows = await prisma.wallpaper.findMany({
      select: { tags: true },
    });
    const out = new Set<string>();
    for (const r of rows) {
      for (const part of (r.tags ?? "").split(/[,，、\s]+/)) {
        const t = part.trim();
        if (t) out.add(t);
      }
    }
    return [...out];
  }

  async listWallpaperTags(): Promise<WallpaperTag[]> {
    const rows = await prisma.wallpaperTag.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
    }));
  }

  async createWallpaperTag(
    name: string,
    sortOrder?: number,
  ): Promise<WallpaperTag | null> {
    const n = name.trim();
    if (!n) return null;
    try {
      const row = await prisma.wallpaperTag.create({
        data: {
          name: n,
          sortOrder: sortOrder ?? (await prisma.wallpaperTag.count()),
        },
      });
      return { id: row.id, name: row.name, sortOrder: row.sortOrder };
    } catch {
      return null;
    }
  }

  async updateWallpaperTag(
    id: number,
    patch: { name?: string; sortOrder?: number },
  ): Promise<WallpaperTag | null> {
    const data: { name?: string; sortOrder?: number } = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return null;
      data.name = n;
    }
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    if (!Object.keys(data).length) {
      const cur = await prisma.wallpaperTag.findUnique({ where: { id } });
      return cur
        ? { id: cur.id, name: cur.name, sortOrder: cur.sortOrder }
        : null;
    }
    try {
      const row = await prisma.wallpaperTag.update({
        where: { id },
        data,
      });
      return { id: row.id, name: row.name, sortOrder: row.sortOrder };
    } catch {
      return null;
    }
  }

  async deleteWallpaperTag(
    id: number,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
    const t = await prisma.wallpaperTag.findUnique({ where: { id } });
    if (!t) return { ok: false, reason: "not_found" };
    const rows = await prisma.wallpaper.findMany({ select: { tags: true } });
    for (const r of rows) {
      for (const part of (r.tags ?? "").split(/[,，、\s]+/)) {
        if (part.trim() === t.name) return { ok: false, reason: "in_use" };
      }
    }
    await prisma.wallpaperTag.delete({ where: { id } });
    return { ok: true };
  }

  async listWallpaperCategories(): Promise<WallpaperCategory[]> {
    const rows = await prisma.wallpaperCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
    }));
  }

  async createWallpaperCategory(
    name: string,
    sortOrder?: number,
  ): Promise<WallpaperCategory | null> {
    const n = name.trim();
    if (!n) return null;
    try {
      const row = await prisma.wallpaperCategory.create({
        data: {
          name: n,
          sortOrder: sortOrder ?? (await prisma.wallpaperCategory.count()),
        },
      });
      return { id: row.id, name: row.name, sortOrder: row.sortOrder };
    } catch {
      return null;
    }
  }

  async updateWallpaperCategory(
    id: number,
    patch: { name?: string; sortOrder?: number },
  ): Promise<WallpaperCategory | null> {
    const data: { name?: string; sortOrder?: number } = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return null;
      data.name = n;
    }
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    if (!Object.keys(data).length) {
      const cur = await prisma.wallpaperCategory.findUnique({ where: { id } });
      return cur
        ? { id: cur.id, name: cur.name, sortOrder: cur.sortOrder }
        : null;
    }
    try {
      const row = await prisma.wallpaperCategory.update({
        where: { id },
        data,
      });
      return { id: row.id, name: row.name, sortOrder: row.sortOrder };
    } catch {
      return null;
    }
  }

  async deleteWallpaperCategory(
    id: number,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
    const c = await prisma.wallpaperCategory.findUnique({ where: { id } });
    if (!c) return { ok: false, reason: "not_found" };
    const rows = await prisma.wallpaper.findMany({ select: { type: true } });
    const used = rows.some((r) => hasTypeToken(r.type, c.name));
    if (used) return { ok: false, reason: "in_use" };
    await prisma.wallpaperCategory.delete({ where: { id } });
    return { ok: true };
  }
}
