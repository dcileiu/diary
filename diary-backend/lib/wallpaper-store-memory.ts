import {
  WALLPAPER_MEDIA_EXTRACT_POINTS_COST,
  type AdminUserSummary,
  type PointRecord,
  type WallItem,
  type WallpaperCategory,
  type WallpaperTag,
  type WxUser,
  WALLPAPER_DOWNLOAD_POINTS_COST,
} from "@/lib/wallpaper-types";
import { WALLPAPER_TAG_PRESETS } from "@/lib/wallpaper-tag-options";
import { isLegacyDefaultAvatarUrl } from "@/lib/default-avatar-legacy";
import { upgradeSameHostAvatarHttpToHttps } from "@/lib/local-upload";
import {
  defaultMiniProgramNickname,
  MINI_PROGRAM_DEFAULT_AVATAR_URL,
} from "@/lib/wx-user-defaults";
import { chinaDayRangeUtc } from "@/lib/china-calendar-day";

const NOW_SEED = () => new Date().toISOString();

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

function tokenFor(uid: string) {
  return `tk_${uid}_${Math.random().toString(36).slice(2, 12)}`;
}

function makeWallpaper(
  id: number,
  fileName: string,
  type: string,
  title: string,
  tags: string,
  groupCode: string,
  extra?: Partial<
    Pick<
      WallItem,
      | "hotScore"
      | "collectCount"
      | "downloading"
      | "avatarList"
      | "theme"
      | "dailyFeatured"
      | "dailyFeaturedSort"
      | "hidden"
    >
  >,
): WallItem {
  return {
    wallpapersId: id,
    groupCode,
    fileName,
    type,
    theme: extra?.theme ?? "",
    title,
    tags,
    hotScore: extra?.hotScore ?? 50 + id,
    collectCount: extra?.collectCount ?? 0,
    downloading: extra?.downloading ?? id % 30,
    avatarList: extra?.avatarList ?? [],
    dailyFeatured: extra?.dailyFeatured ?? false,
    dailyFeaturedSort: extra?.dailyFeaturedSort ?? 0,
    hidden: extra?.hidden ?? false,
  };
}

type CollectionEntry = { uid: string; wallpapersId: number; at: string };
type DownloadEntry = { uid: string; wallpapersId: number; at: string };

export class MemoryWallpaperStore {
  private userSeq = 1;
  private wpSeq = 1;
  private users = new Map<string, WxUser>();
  private tokenToUserId = new Map<string, string>();
  private wallpapers: WallItem[] = [];
  private collections: CollectionEntry[] = [];
  private downloads: DownloadEntry[] = [];
  private pointRecords: PointRecord[] = [];
  private pointRecordSeq = 1;
  private categories: WallpaperCategory[] = [];
  private categorySeq = 1;
  private tags: WallpaperTag[] = [];
  private tagSeq = 1;

  constructor() {
    this.seed();
  }

  private seed() {
    const samples: WallItem[] = [
      makeWallpaper(
        this.wpSeq++,
        "demo_phone_001.jpg",
        "手机壁纸",
        "自然风光",
        "风景,自然",
        "830014",
        { hotScore: 120 },
      ),
      makeWallpaper(
        this.wpSeq++,
        "demo_phone_002.jpg",
        "手机壁纸",
        "极简生活",
        "极简,生活",
        "830014",
      ),
      makeWallpaper(
        this.wpSeq++,
        "demo_avatar_001.jpg",
        "头像",
        "卡通插画",
        "插画,卡通",
        "920155",
      ),
      makeWallpaper(
        this.wpSeq++,
        "demo_pc_001.jpg",
        "电脑平板",
        "城市夜景",
        "城市,视觉",
        "441022",
      ),
      makeWallpaper(
        this.wpSeq++,
        "demo_photo_001.jpg",
        "创意摄影",
        "抽象创意",
        "创意,抽象",
        "441022",
      ),
    ];
    this.wallpapers = samples;
    const defaultCategoryNames = ["手机壁纸", "头像", "电脑平板", "创意摄影"];
    this.categories = defaultCategoryNames.map((name, i) => ({
      id: this.categorySeq++,
      name,
      sortOrder: i,
    }));
    this.tags = WALLPAPER_TAG_PRESETS.map((name, i) => ({
      id: this.tagSeq++,
      name,
      sortOrder: i,
    }));
  }

  async loginByOpenId(
    openId: string,
    options?: { defaultAvatarUrl?: string; inviterId?: string },
  ): Promise<WxUser> {
    let user = [...this.users.values()].find((u) => u.openId === openId);
    if (!user) {
      const id = String(this.userSeq++);
      user = {
        id,
        openId,
        accessToken: tokenFor(id),
        nickname: defaultMiniProgramNickname(),
        avatar: options?.defaultAvatarUrl ?? MINI_PROGRAM_DEFAULT_AVATAR_URL,
        color: "#22c55e",
        points: 2,
        isVip: "0",
      };
      this.users.set(id, user);
      const inviterNum = Number(options?.inviterId);
      const inviterId =
        Number.isFinite(inviterNum) && inviterNum > 0
          ? String(Math.floor(inviterNum))
          : "";
      if (inviterId && inviterId !== id && this.users.has(inviterId)) {
        const inviter = this.users.get(inviterId);
        if (inviter) {
          inviter.points = (inviter.points ?? 0) + 15;
          this.pushPointRecord(inviterId, "邀请", 15, "1");
        }
      }
    } else {
      const newTok = tokenFor(user.id);
      this.tokenToUserId.delete(user.accessToken);
      user.accessToken = newTok;
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

      if (
        canonical &&
        isLegacyDefaultAvatarUrl(user.avatar, { siteOrigin })
      ) {
        user.avatar = canonical;
      } else if (siteOrigin) {
        const upgraded = upgradeSameHostAvatarHttpToHttps(
          user.avatar,
          siteOrigin,
        );
        if (upgraded) user.avatar = upgraded;
      }
    }
    this.tokenToUserId.set(user.accessToken, user.id);
    return Promise.resolve({ ...user });
  }

  async authUser(authorization: string | null): Promise<WxUser | null> {
    if (!authorization) return Promise.resolve(null);
    const tok = authorization.replace(/^Bearer\s+/i, "").trim();
    const uid = this.tokenToUserId.get(tok);
    if (!uid) return Promise.resolve(null);
    const u = this.users.get(uid);
    return Promise.resolve(u ? { ...u } : null);
  }

  async listWallpapers(): Promise<WallItem[]> {
    return Promise.resolve([...this.wallpapers]);
  }

  async listWallpapersPaged(
    page: number,
    limit: number,
  ): Promise<{ list: WallItem[]; total: number; page: number; limit: number }> {
    const sorted = [...this.wallpapers].sort(
      (a, b) => (b.wallpapersId ?? 0) - (a.wallpapersId ?? 0),
    );
    const total = sorted.length;
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const maxPage = Math.max(1, Math.ceil(total / safeLimit) || 1);
    const safePage = Math.min(maxPage, Math.max(1, Math.floor(page)));
    const start = (safePage - 1) * safeLimit;
    const list = sorted.slice(start, start + safeLimit);
    return Promise.resolve({
      list,
      total,
      page: safePage,
      limit: safeLimit,
    });
  }

  async upsertWallpaper(
    w: Omit<WallItem, "wallpapersId"> & { wallpapersId?: number },
  ) {
    if (w.wallpapersId) {
      const i = this.wallpapers.findIndex(
        (x) => x.wallpapersId === w.wallpapersId,
      );
      if (i >= 0) {
        this.wallpapers[i] = { ...this.wallpapers[i], ...w };
        return Promise.resolve(this.wallpapers[i]);
      }
    }
    const item: WallItem = {
      ...w,
      wallpapersId: this.wpSeq++,
      hotScore: w.hotScore ?? 0,
      downloading: w.downloading ?? 0,
      theme: w.theme ?? "",
      title: w.title ?? "",
      tags: w.tags ?? "",
      groupCode: w.groupCode ?? "000000",
      dailyFeatured: w.dailyFeatured ?? false,
      dailyFeaturedSort: w.dailyFeaturedSort ?? 0,
      hidden: w.hidden ?? false,
    };
    this.wallpapers.push(item);
    return Promise.resolve(item);
  }

  async deleteWallpaper(id: number): Promise<void> {
    this.wallpapers = this.wallpapers.filter((x) => x.wallpapersId !== id);
  }

  async updateWallpaper(id: number, patch: Partial<WallItem>) {
    const i = this.wallpapers.findIndex((x) => x.wallpapersId === id);
    if (i < 0) return Promise.resolve(null);
    const existing = this.wallpapers[i]!;

    if (
      patch.dailyFeatured !== undefined ||
      patch.dailyFeaturedSort !== undefined
    ) {
      let nf =
        patch.dailyFeatured !== undefined
          ? Boolean(patch.dailyFeatured)
          : Boolean(existing.dailyFeatured);
      let ns =
        patch.dailyFeaturedSort !== undefined
          ? Math.max(
              0,
              Math.min(
                9999,
                Math.floor(Number(patch.dailyFeaturedSort)),
              ),
            )
          : (existing.dailyFeaturedSort ?? 0);
      if (patch.dailyFeatured === false) {
        nf = false;
        ns = 0;
      } else if (
        patch.dailyFeatured === true &&
        !existing.dailyFeatured &&
        patch.dailyFeaturedSort === undefined
      ) {
        const maxSort = Math.max(
          0,
          ...this.wallpapers
            .filter((x) => x.dailyFeatured && x.wallpapersId !== id)
            .map((x) => x.dailyFeaturedSort ?? 0),
        );
        ns = maxSort + 1;
      }
      if (!nf) ns = 0;
      patch = {
        ...patch,
        dailyFeatured: nf,
        dailyFeaturedSort: ns,
      };
    }

    this.wallpapers[i] = { ...existing, ...patch };
    return Promise.resolve(this.wallpapers[i]);
  }

  async stats() {
    return Promise.resolve({
      wallpaperCount: this.wallpapers.length,
      userCount: this.users.size,
      collectionCount: this.collections.length,
      downloadCount: this.downloads.length,
    });
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
  }) {
    let list = [...this.wallpapers];
    if (params.type) {
      list = list.filter((x) => hasTypeToken(x.type, params.type!));
    }
    if (params.groupCode) {
      const g = params.groupCode.trim();
      list = list.filter((x) => x.groupCode === g);
    }
    if (params.theme) {
      const t = params.theme.trim();
      if (t) {
        list = list.filter((x) => String(x.theme ?? "").includes(t));
      }
    }
    if (params.search) {
      const q = params.search.trim();
      if (q) {
        list = list.filter((x) => {
          const theme = String(x.theme ?? "");
          const tags = String(x.tags ?? "");
          return theme.includes(q) || tags.includes(q);
        });
      }
    }
    list = list.filter((x) => !x.hidden);
    if (params.tags) {
      const t = params.tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (t.length) {
        list = list.filter((x) => {
          const tagStr = x.tags ?? "";
          return t.some((k) => tagStr.includes(k));
        });
      }
    }
    if (params.selectFlag === 1) {
      list.sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0));
    } else {
      list.sort((a, b) => (b.wallpapersId ?? 0) - (a.wallpapersId ?? 0));
    }
    const total = list.length;
    const start = (params.page - 1) * params.limit;
    const records = list.slice(start, start + params.limit);
    return Promise.resolve({ records, total });
  }

  async indexData() {
    const all = (await this.listWallpapers()).filter((x) => !x.hidden);
    const phone = all.filter((x) => hasTypeToken(x.type, "手机壁纸")).slice(0, 8);
    const featured = all
      .filter((x) => x.dailyFeatured)
      .sort(
        (a, b) =>
          (a.dailyFeaturedSort ?? 999999) - (b.dailyFeaturedSort ?? 999999) ||
          (b.wallpapersId ?? 0) - (a.wallpapersId ?? 0),
      )
      .slice(0, 12);
    let swiperImages = featured;
    if (!swiperImages.length) {
      const fb = all.filter((x) => hasTypeToken(x.type, "手机壁纸")).slice(0, 5);
      swiperImages = fb.length ? fb : all.slice(0, 5);
    }
    const scrollAvatars = all.filter((x) => hasTypeToken(x.type, "头像")).slice(0, 12);
    return Promise.resolve({
      phoneImages: phone.length ? phone : all.slice(0, 8),
      swiperImages,
      scrollAvatars: scrollAvatars.length ? scrollAvatars : all.slice(0, 6),
    });
  }

  async ranking(num: number): Promise<WallItem[][]> {
    const sorted = [...this.wallpapers]
      .filter((x) => !x.hidden)
      .sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0));
    const pick = () => sorted.slice(0, num);
    return Promise.resolve([pick(), pick(), pick(), pick()]);
  }

  async collectState(uid: string, ids: number[]) {
    const set = new Set(
      this.collections.filter((c) => c.uid === uid).map((c) => c.wallpapersId),
    );
    return Promise.resolve(
      ids.filter((id) => set.has(id)).map((wallpapersId) => ({ wallpapersId })),
    );
  }

  async collectAdd(uid: string, wallpapersId: number): Promise<void> {
    if (
      !this.collections.some(
        (c) => c.uid === uid && c.wallpapersId === wallpapersId,
      )
    ) {
      this.collections.push({
        uid,
        wallpapersId,
        at: NOW_SEED(),
      });
      const w = this.wallpapers.find((x) => x.wallpapersId === wallpapersId);
      if (w) w.collectCount = Math.max(0, Number(w.collectCount ?? 0) + 1);
    }
  }

  async collectCount(wallpapersId: number): Promise<number> {
    const wid = Number(wallpapersId);
    if (!Number.isFinite(wid) || wid < 1) return Promise.resolve(0);
    const w = this.wallpapers.find((x) => x.wallpapersId === wid);
    const n = w ? Number(w.collectCount ?? 0) : 0;
    return Promise.resolve(Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  }

  async collectRemove(uid: string, wallpapersId: number): Promise<void> {
    const before = this.collections.length;
    this.collections = this.collections.filter(
      (c) => !(c.uid === uid && c.wallpapersId === wallpapersId),
    );
    const dec = Math.max(0, before - this.collections.length);
    if (dec > 0) {
      const w = this.wallpapers.find((x) => x.wallpapersId === wallpapersId);
      if (w) w.collectCount = Math.max(0, Number(w.collectCount ?? 0) - dec);
    }
  }

  async collectForDate(uid: string, page: number, limit: number) {
    const mine = this.collections.filter((c) => c.uid === uid);
    const byDay = new Map<string, WallItem[]>();
    for (const c of mine) {
      const day = c.at.slice(0, 10);
      const w = this.wallpapers.find((x) => x.wallpapersId === c.wallpapersId);
      if (!w || w.hidden) continue;
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
    return Promise.resolve({ records, total });
  }

  async collectPage(uid: string, page: number, limit: number) {
    const mine = [...this.collections]
      .filter((c) => c.uid === uid)
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    const seen = new Set<number>();
    const ordered: WallItem[] = [];
    for (const c of mine) {
      if (seen.has(c.wallpapersId)) continue;
      seen.add(c.wallpapersId);
      const w = this.wallpapers.find((x) => x.wallpapersId === c.wallpapersId);
      if (w && !w.hidden) ordered.push({ ...w });
    }
    const total = ordered.length;
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const safePage = Math.max(1, Math.floor(page));
    const start = (safePage - 1) * safeLimit;
    const records = ordered.slice(start, start + safeLimit);
    return Promise.resolve({ records, total });
  }

  async actionPage(uid: string, type: string, page: number, limit: number) {
    if (type === "2") {
      const mine = [...this.downloads]
        .filter((d) => d.uid === uid)
        .sort((a, b) => (a.at < b.at ? 1 : -1));
      const items = mine
        .map((d) =>
          this.wallpapers.find((w) => w.wallpapersId === d.wallpapersId),
        )
        .filter((w): w is WallItem => w != null && !w.hidden);
      const start = (page - 1) * limit;
      const records = items.slice(start, start + limit);
      return Promise.resolve({ records, total: items.length });
    }
    return Promise.resolve({ records: [] as WallItem[], total: 0 });
  }

  async actionCount(uid: string) {
    const vis = (wid: number) => {
      const w = this.wallpapers.find((x) => x.wallpapersId === wid);
      return w && !w.hidden;
    };
    const collectSum = this.collections.filter(
      (c) => c.uid === uid && vis(c.wallpapersId),
    ).length;
    const downloadSum = this.downloads.filter(
      (d) => d.uid === uid && vis(d.wallpapersId),
    ).length;
    return Promise.resolve({ collectSum, downloadSum });
  }

  async logDownload(uid: string, wallpapersId: number): Promise<void> {
    this.downloads.push({ uid, wallpapersId, at: NOW_SEED() });
    const w = this.wallpapers.find((x) => x.wallpapersId === wallpapersId);
    if (w) w.downloading = (w.downloading ?? 0) + 1;
  }

  async completeDownload(
    uid: string,
    wallpapersId: number,
  ): Promise<{ user: WxUser } | { err: "发财鸭不足" | "壁纸不存在" } | null> {
    const user = this.users.get(uid);
    if (!user) return Promise.resolve(null);
    const wallpaper = this.wallpapers.find((w) => w.wallpapersId === wallpapersId);
    if (!wallpaper || wallpaper.hidden) {
      return Promise.resolve({ err: "壁纸不存在" as const });
    }
    const existingLog = this.downloads.some(
      (d) => d.uid === uid && d.wallpapersId === wallpapersId,
    );
    if (existingLog) {
      return Promise.resolve({ user: { ...user } });
    }
    if (
      user.isVip !== "2" &&
      user.points < WALLPAPER_DOWNLOAD_POINTS_COST
    ) {
      return Promise.resolve({ err: "发财鸭不足" as const });
    }
    if (user.isVip !== "2") {
      user.points -= WALLPAPER_DOWNLOAD_POINTS_COST;
      this.pushPointRecord(
        uid,
        "下载扣减",
        -WALLPAPER_DOWNLOAD_POINTS_COST,
        "2",
      );
    }
    this.downloads.push({ uid, wallpapersId, at: NOW_SEED() });
    wallpaper.downloading = (wallpaper.downloading ?? 0) + 1;
    this.tokenToUserId.set(user.accessToken, user.id);
    return Promise.resolve({ user: { ...user } });
  }

  async points(uid: string, body: { type: string; operation?: string }) {
    const user = this.users.get(uid);
    if (!user) return Promise.resolve(null);
    if (body.type === "2") {
      if (
        user.points < WALLPAPER_DOWNLOAD_POINTS_COST &&
        user.isVip !== "2"
      )
        return Promise.resolve({ err: "发财鸭不足" as const });
      if (user.isVip !== "2") {
        user.points -= WALLPAPER_DOWNLOAD_POINTS_COST;
        this.pushPointRecord(
          uid,
          "下载扣减",
          -WALLPAPER_DOWNLOAD_POINTS_COST,
          "2",
        );
      }
      return Promise.resolve({ user: { ...user } });
    }
    if (body.type === "3") {
      if (
        user.points < WALLPAPER_MEDIA_EXTRACT_POINTS_COST &&
        user.isVip !== "2"
      ) {
        return Promise.resolve({ err: "发财鸭不足" as const });
      }
      if (user.isVip !== "2") {
        user.points -= WALLPAPER_MEDIA_EXTRACT_POINTS_COST;
        this.pushPointRecord(
          uid,
          "去水印扣减",
          -WALLPAPER_MEDIA_EXTRACT_POINTS_COST,
          "2",
        );
      }
      return Promise.resolve({ user: { ...user } });
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
      if (msg === "签到" || msg === "分享") {
        const { start, end } = chinaDayRangeUtc();
        const t0 = start.getTime();
        const t1 = end.getTime();
        const dup = this.pointRecords.some((r) => {
          if (r.uid !== uid || r.content !== msg) return false;
          const t = new Date(r.createTime).getTime();
          return t >= t0 && t < t1;
        });
        if (dup) {
          return Promise.resolve({
            err:
              msg === "签到"
                ? ("今日已签到" as const)
                : ("今日分享奖励已领取" as const),
          });
        }
      }
      user.points += add;
      if (add) this.pushPointRecord(uid, msg, add, "1");
      this.tokenToUserId.set(user.accessToken, user.id);
      return Promise.resolve({ user: { ...user } });
    }
    return Promise.resolve({ user: { ...user } });
  }

  private pushPointRecord(
    uid: string,
    content: string,
    points: number,
    type: string,
  ) {
    this.pointRecords.push({
      id: String(this.pointRecordSeq++),
      uid,
      content,
      points,
      type,
      createTime: NOW_SEED(),
    });
  }

  async pointRecordPage(uid: string, page: number, limit: number) {
    const list = this.pointRecords
      .filter((r) => r.uid === uid)
      .sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
    const start = (page - 1) * limit;
    const records = list.slice(start, start + limit).map((r) => ({
      content: r.content,
      points: r.points,
      type: r.type,
      createTime: r.createTime,
    }));
    return Promise.resolve({ records, total: list.length });
  }

  async updateNickname(uid: string, nickname: string) {
    const u = this.users.get(uid);
    if (!u) return Promise.resolve(null);
    u.nickname = nickname;
    return Promise.resolve({ ...u });
  }

  async updateAvatar(uid: string, avatarUrl: string) {
    const u = this.users.get(uid);
    if (!u) return Promise.resolve(null);
    u.avatar = avatarUrl;
    return Promise.resolve({ ...u });
  }

  async listUsersForAdmin(): Promise<AdminUserSummary[]> {
    const list = [...this.users.values()].map((u) => ({ ...u }));
    return Promise.all(
      list.map(async (u) => {
        const { collectSum, downloadSum } = await this.actionCount(u.id);
        return {
          id: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          color: u.color,
          points: u.points,
          isVip: u.isVip,
          collectSum,
          downloadSum,
        };
      }),
    );
  }

  async listDistinctWallpaperTagTokens(): Promise<string[]> {
    const out = new Set<string>();
    for (const w of this.wallpapers) {
      for (const part of (w.tags ?? "").split(/[,，、\s]+/)) {
        const t = part.trim();
        if (t) out.add(t);
      }
    }
    return [...out];
  }

  async listWallpaperTags(): Promise<WallpaperTag[]> {
    return Promise.resolve(
      [...this.tags].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
      ),
    );
  }

  async createWallpaperTag(
    name: string,
    sortOrder?: number,
  ): Promise<WallpaperTag | null> {
    const n = name.trim();
    if (!n) return Promise.resolve(null);
    if (this.tags.some((t) => t.name === n)) return Promise.resolve(null);
    const row: WallpaperTag = {
      id: this.tagSeq++,
      name: n,
      sortOrder: sortOrder ?? this.tags.length,
    };
    this.tags.push(row);
    return Promise.resolve({ ...row });
  }

  async updateWallpaperTag(
    id: number,
    patch: { name?: string; sortOrder?: number },
  ): Promise<WallpaperTag | null> {
    const i = this.tags.findIndex((t) => t.id === id);
    if (i < 0) return Promise.resolve(null);
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return Promise.resolve(null);
      if (this.tags.some((t) => t.name === n && t.id !== id)) {
        return Promise.resolve(null);
      }
      this.tags[i]!.name = n;
    }
    if (patch.sortOrder !== undefined) {
      this.tags[i]!.sortOrder = patch.sortOrder;
    }
    return Promise.resolve({ ...this.tags[i]! });
  }

  async deleteWallpaperTag(
    id: number,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
    const t = this.tags.find((x) => x.id === id);
    if (!t) return Promise.resolve({ ok: false, reason: "not_found" });
    const inUse = this.wallpapers.some((w) =>
      (w.tags ?? "")
        .split(/[,，、\s]+/)
        .some((p) => p.trim() === t.name),
    );
    if (inUse) return Promise.resolve({ ok: false, reason: "in_use" });
    this.tags = this.tags.filter((x) => x.id !== id);
    return Promise.resolve({ ok: true });
  }

  async listWallpaperCategories(): Promise<WallpaperCategory[]> {
    return Promise.resolve(
      [...this.categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
      ),
    );
  }

  async createWallpaperCategory(
    name: string,
    sortOrder?: number,
  ): Promise<WallpaperCategory | null> {
    const n = name.trim();
    if (!n) return Promise.resolve(null);
    if (this.categories.some((c) => c.name === n)) return Promise.resolve(null);
    const row: WallpaperCategory = {
      id: this.categorySeq++,
      name: n,
      sortOrder: sortOrder ?? this.categories.length,
    };
    this.categories.push(row);
    return Promise.resolve({ ...row });
  }

  async updateWallpaperCategory(
    id: number,
    patch: { name?: string; sortOrder?: number },
  ): Promise<WallpaperCategory | null> {
    const i = this.categories.findIndex((c) => c.id === id);
    if (i < 0) return Promise.resolve(null);
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return Promise.resolve(null);
      if (this.categories.some((c) => c.name === n && c.id !== id)) {
        return Promise.resolve(null);
      }
      this.categories[i]!.name = n;
    }
    if (patch.sortOrder !== undefined) {
      this.categories[i]!.sortOrder = patch.sortOrder;
    }
    return Promise.resolve({ ...this.categories[i]! });
  }

  async deleteWallpaperCategory(
    id: number,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
    const c = this.categories.find((x) => x.id === id);
    if (!c) return Promise.resolve({ ok: false, reason: "not_found" });
    const inUse = this.wallpapers.some((w) => hasTypeToken(w.type, c.name));
    if (inUse) return Promise.resolve({ ok: false, reason: "in_use" });
    this.categories = this.categories.filter((x) => x.id !== id);
    return Promise.resolve({ ok: true });
  }
}
