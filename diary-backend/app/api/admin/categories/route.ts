import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { prisma } from "@/lib/prisma";
import { asText, clampInt } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAdmin("admin/categories", async () => {
  const list = await prisma.diaryCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return adminJson({
    code: 0,
    data: {
      list: list.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color,
        sortOrder: item.sortOrder,
        entryCount: item._count.entries,
      })),
    },
  });
});

export const POST = withAdmin("admin/categories", async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = asText(body.name);
  if (!name) {
    return adminJson({ code: 400, message: "分类名称不能为空" }, { status: 400 });
  }

  const created = await prisma.diaryCategory.create({
    data: {
      name,
      description: asText(body.description),
      color: asText(body.color) || "#E85D75",
      sortOrder: clampInt(body.sortOrder, 0, 9999, 0),
    },
  });

  return adminJson({ code: 0, data: created });
});
