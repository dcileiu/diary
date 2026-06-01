import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { prisma } from "@/lib/prisma";
import { readNumericId } from "@/lib/route-helpers";
import { asText, clampInt } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const PATCH = withAdmin("admin/categories/[id]", async (req) => {
  const id = readNumericId(req);
  if (!id) {
    return adminJson({ code: 400, message: "分类 ID 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = asText(body.name);
  if (!name) {
    return adminJson({ code: 400, message: "分类名称不能为空" }, { status: 400 });
  }

  const updated = await prisma.diaryCategory.update({
    where: { id },
    data: {
      name,
      description: asText(body.description),
      color: asText(body.color) || "#E85D75",
      sortOrder: clampInt(body.sortOrder, 0, 9999, 0),
    },
  });
  return adminJson({ code: 0, data: updated });
});

export const DELETE = withAdmin("admin/categories/[id]", async (req) => {
  const id = readNumericId(req);
  if (!id) {
    return adminJson({ code: 400, message: "分类 ID 无效" }, { status: 400 });
  }

  const count = await prisma.diaryEntry.count({ where: { categoryId: id } });
  if (count > 0) {
    return adminJson(
      { code: 400, message: "该分类下仍有条目，暂时不能删除" },
      { status: 400 },
    );
  }

  await prisma.diaryCategory.delete({ where: { id } });
  return adminJson({ code: 0, data: true });
});
