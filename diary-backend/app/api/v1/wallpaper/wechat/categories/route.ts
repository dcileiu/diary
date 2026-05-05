import { getWallpaperStore } from "@/lib/wallpaper-store";
import { mpErrorMessage, mpOk, mpServerError } from "@/lib/mp-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handle() {
  try {
    const list = await getWallpaperStore().listWallpaperCategories();
    return mpOk({ list, total: list.length });
  } catch (e) {
    console.error("[wechat/categories]", e);
    return mpServerError(
      process.env.NODE_ENV === "development"
        ? `服务器错误: ${mpErrorMessage(e)}`
        : "服务暂不可用，请稍后重试",
    );
  }
}

/** 小程序可读壁纸分类（与后台「分类管理」一致，用于筛选等） */
export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
