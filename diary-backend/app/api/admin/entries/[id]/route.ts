import { adminJson } from "@/lib/admin-api-response";
import { withAdmin } from "@/lib/admin-route";
import { isResolvedStatus, normalizeStatusOrNull } from "@/lib/diary-status";
import { prisma } from "@/lib/prisma";
import { readNumericId } from "@/lib/route-helpers";
import { positiveInt } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const PATCH = withAdmin("admin/entries/[id]", async (req) => {
  const id = readNumericId(req);
  if (!id) {
    return adminJson({ code: 400, message: "条目 ID 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (body.status != null) {
    const status = normalizeStatusOrNull(body.status);
    if (!status) {
      return adminJson({ code: 400, message: "状态无效" }, { status: 400 });
    }
    patch.status = status;
    patch.settledAt = isResolvedStatus(status) ? new Date() : null;
  }
  if (body.isPinned != null) patch.isPinned = Boolean(body.isPinned);
  if (body.categoryId !== undefined) {
    patch.categoryId = positiveInt(body.categoryId);
  }

  const updated = await prisma.diaryEntry.update({ where: { id }, data: patch });
  return adminJson({ code: 0, data: updated });
});
