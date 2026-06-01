import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { prisma } from "@/lib/prisma";
import { asText, parsePagination } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAdmin("admin/users", async (req) => {
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(
    url.searchParams.get("page"),
    url.searchParams.get("limit"),
    { defaultPageSize: 20, maxPageSize: 100 },
  );
  const keyword = asText(url.searchParams.get("keyword"));

  const where = keyword ? { nickname: { contains: keyword } } : {};

  const [total, list] = await Promise.all([
    prisma.wxUser.count({ where }),
    prisma.wxUser.findMany({
      where,
      orderBy: [{ lastEntryAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
  ]);

  return adminJson({
    code: 0,
    data: {
      page,
      limit: pageSize,
      total,
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
});
