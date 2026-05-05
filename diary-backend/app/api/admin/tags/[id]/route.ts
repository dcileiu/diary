import { adminJson } from "@/lib/admin-api-response";
import { ensureAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function readId(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return Number(parts.at(-1));
}

export async function PATCH(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;
  const id = readId(req);
  if (!Number.isInteger(id) || id <= 0) {
    return adminJson({ code: 400, message: "标签 ID 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return adminJson({ code: 400, message: "标签名称不能为空" }, { status: 400 });
  }

  const updated = await prisma.diaryTag.update({
    where: { id },
    data: {
      name,
      color: String(body.color ?? "").trim() || "#577590",
      sortOrder: Number(body.sortOrder) || 0,
    },
  });

  return adminJson({ code: 0, data: updated });
}

export async function DELETE(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;
  const id = readId(req);
  if (!Number.isInteger(id) || id <= 0) {
    return adminJson({ code: 400, message: "标签 ID 无效" }, { status: 400 });
  }

  const count = await prisma.diaryEntryTag.count({ where: { tagId: id } });
  if (count > 0) {
    return adminJson(
      { code: 400, message: "该标签仍被条目使用，暂时不能删除" },
      { status: 400 },
    );
  }

  await prisma.diaryTag.delete({ where: { id } });
  return adminJson({ code: 0, data: true });
}
