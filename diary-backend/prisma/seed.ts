import { PrismaClient } from "@prisma/client";
import { WALLPAPER_TAG_PRESETS } from "../lib/wallpaper-tag-options";

const prisma = new PrismaClient();

async function main() {
  const catCount = await prisma.wallpaperCategory.count();
  if (catCount === 0) {
    await prisma.wallpaperCategory.createMany({
      data: [
        { name: "手机壁纸", sortOrder: 0 },
        { name: "头像", sortOrder: 1 },
        { name: "电脑平板", sortOrder: 2 },
        { name: "创意摄影", sortOrder: 3 },
      ],
    });
    console.log("已写入默认壁纸分类");
  }

  const tagCount = await prisma.wallpaperTag.count();
  if (tagCount === 0) {
    await prisma.wallpaperTag.createMany({
      data: WALLPAPER_TAG_PRESETS.map((name, i) => ({
        name,
        sortOrder: i,
      })),
    });
    console.log("已写入默认壁纸标签（wallpaper_tag）");
  }

  const n = await prisma.wallpaper.count();
  if (n > 0) {
    console.log("wallpaper 表已有数据，跳过壁纸 seed");
    return;
  }
  await prisma.wallpaper.createMany({
    data: [
      {
        groupCode: "830014",
        fileName: "demo_phone_001.jpg",
        type: "手机壁纸",
        title: "自然风光",
        tags: "风景,自然",
        hotScore: 120,
        downloading: 1,
      },
      {
        groupCode: "830014",
        fileName: "demo_phone_002.jpg",
        type: "手机壁纸",
        title: "极简生活",
        tags: "极简,生活",
        hotScore: 52,
        downloading: 2,
      },
      {
        groupCode: "920155",
        fileName: "demo_avatar_001.jpg",
        type: "头像",
        title: "卡通插画",
        tags: "插画,卡通",
        hotScore: 53,
        downloading: 3,
      },
      {
        groupCode: "441022",
        fileName: "demo_pc_001.jpg",
        type: "电脑平板",
        title: "城市夜景",
        tags: "城市,视觉",
        hotScore: 54,
        downloading: 4,
      },
      {
        groupCode: "441022",
        fileName: "demo_photo_001.jpg",
        type: "创意摄影",
        title: "抽象创意",
        tags: "创意,抽象",
        hotScore: 55,
        downloading: 5,
      },
    ],
  });
  console.log("已写入 5 条 demo 壁纸");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
