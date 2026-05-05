import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;

  const list = await prisma.diaryCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      _count: {
        select: { entries: true },
      },
    },
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
}

export async function POST(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return adminJson({ code: 400, message: "分类名称不能为空" }, { status: 400 });
  }

  const created = await prisma.diaryCategory.create({
    data: {
      name,
      description: String(body.description ?? "").trim(),
      color: String(body.color ?? "").trim() || "#E85D75",
      sortOrder: Number(body.sortOrder) || 0,
    },
  });

  return adminJson({ code: 0, data: created });
}
