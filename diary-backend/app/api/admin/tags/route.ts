import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { prisma } from "@/lib/prisma";
import { asText, clampInt } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAdmin("admin/tags", async () => {
  const list = await prisma.diaryTag.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { entryTags: true } } },
  });

  return adminJson({
    code: 0,
    data: {
      list: list.map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        sortOrder: item.sortOrder,
        entryCount: item._count.entryTags,
      })),
    },
  });
});

export const POST = withAdmin("admin/tags", async (req) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = asText(body.name);
  if (!name) {
    return adminJson({ code: 400, message: "标签名称不能为空" }, { status: 400 });
  }

  const created = await prisma.diaryTag.create({
    data: {
      name,
      color: asText(body.color) || "#577590",
      sortOrder: clampInt(body.sortOrder, 0, 9999, 0),
    },
  });

  return adminJson({ code: 0, data: created });
});
