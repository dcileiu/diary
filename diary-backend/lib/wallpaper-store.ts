import { DbWallpaperStore } from "@/lib/wallpaper-store-db";
import { MemoryWallpaperStore } from "@/lib/wallpaper-store-memory";
import {
  allowMemoryStoreFallback,
  missingDatabaseConfig,
} from "@/lib/runtime-config";

export type {
  PointRecord,
  WallItem,
  WallpaperCategory,
  WallpaperTag,
  WxUser,
} from "@/lib/wallpaper-types";

export type WallpaperStore = MemoryWallpaperStore | DbWallpaperStore;

const g = globalThis as unknown as {
  __wallpaperStore?: WallpaperStore;
  __wallpaperStoreMode?: "memory" | "db";
};

export function getWallpaperStore(): WallpaperStore {
  if (missingDatabaseConfig() && !allowMemoryStoreFallback()) {
    throw new Error(
      "DATABASE_URL 未配置，生产环境禁止回退到内存存储",
    );
  }
  const mode = missingDatabaseConfig() ? "memory" : "db";
  if (g.__wallpaperStore && g.__wallpaperStoreMode === mode) {
    return g.__wallpaperStore;
  }
  g.__wallpaperStoreMode = mode;
  g.__wallpaperStore =
    mode === "db" ? new DbWallpaperStore() : new MemoryWallpaperStore();
  return g.__wallpaperStore;
}
