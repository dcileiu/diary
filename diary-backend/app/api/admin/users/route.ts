import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;

  const list = await prisma.wxUser.findMany({
    orderBy: [{ lastEntryAt: "desc" }, { createdAt: "desc" }],
  });

  return adminJson({
    code: 0,
    data: {
      total: list.length,
      list: list.map((item) => ({
        id: item.id,
        nickname: item.nickname,
        avatar: item.avatar,
        bio: item.bio,
        totalEntryCount: item.totalEntryCount,
        activeEntryCount: item.activeEntryCount,
        resolvedEntryCount: item.resolvedEntryCount,
        lastEntryAt: item.lastEntryAt?.toISOString() ?? "",
        createdAt: item.createdAt.toISOString(),
      })),
    },
  });
}
