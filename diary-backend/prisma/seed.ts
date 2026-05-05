import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_DIARY_CATEGORIES,
  DEFAULT_DIARY_TAGS,
} from "../lib/diary-constants";

const prisma = new PrismaClient();

async function main() {
  const catCount = await prisma.diaryCategory.count();
  if (catCount === 0) {
    await prisma.diaryCategory.createMany({
      data: DEFAULT_DIARY_CATEGORIES.map((item) => ({ ...item })),
    });
    console.log("已写入默认记仇分类");
  }

  const tagCount = await prisma.diaryTag.count();
  if (tagCount === 0) {
    await prisma.diaryTag.createMany({
      data: DEFAULT_DIARY_TAGS.map((item) => ({ ...item })),
    });
    console.log("已写入默认记仇标签");
  }

  const userCount = await prisma.wxUser.count();
  if (userCount > 0) {
    console.log("已存在用户数据，跳过示例记仇数据写入");
    return;
  }

  const categories = await prisma.diaryCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const tags = await prisma.diaryTag.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const sampleUser = await prisma.wxUser.create({
    data: {
      openId: "__seed_demo_openid__",
      accessToken: "__seed_demo_token__",
      nickname: "记仇体验官",
      avatar: "",
      bio: "这是初始化演示数据，可直接删除或继续改造。",
    },
  });

  const created = await prisma.diaryEntry.create({
    data: {
      userId: sampleUser.id,
      categoryId: categories[1]?.id ?? categories[0]?.id ?? null,
      title: "临时被甩锅，周会前一小时才通知我",
      content:
        "原本不是我负责的内容，被同事临时推到我这边，还要求我当场收尾。虽然最后扛住了，但整个过程非常憋屈。",
      targetName: "某同事",
      targetRelation: "同事",
      location: "会议室",
      grievanceLevel: 5,
      emotionLevel: 4,
      status: "OPEN",
      isPinned: true,
      happenedAt: new Date("2026-05-04T09:30:00+08:00"),
      tags: {
        create: tags
          .filter((tag) => ["甩锅", "公开失礼"].includes(tag.name))
          .map((tag) => ({
            tagId: tag.id,
          })),
      },
      followUps: {
        create: [
          {
            userId: sampleUser.id,
            type: "NOTE",
            content: "会后我把聊天记录和任务分工都整理好了，防止下次继续口说无凭。",
            emotionDelta: -1,
          },
          {
            userId: sampleUser.id,
            type: "REFLECTION",
            content: "以后遇到临时加塞，先确认责任边界，再决定帮不帮。",
            emotionDelta: -1,
          },
        ],
      },
    },
  });

  await prisma.diaryEntry.update({
    where: { id: created.id },
    data: {
      followUpCount: 2,
      lastFollowUpAt: new Date(),
    },
  });

  await prisma.wxUser.update({
    where: { id: sampleUser.id },
    data: {
      totalEntryCount: 1,
      activeEntryCount: 1,
      resolvedEntryCount: 0,
      lastEntryAt: created.happenedAt,
    },
  });

  console.log("已写入 1 条演示记仇日记");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
