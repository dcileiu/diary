import { DiaryEntryStatus } from "@prisma/client";

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

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  const allowed = Object.values(DiaryEntryStatus);
  return allowed.includes(raw as DiaryEntryStatus)
    ? (raw as DiaryEntryStatus)
    : null;
}

function isResolvedStatus(status: DiaryEntryStatus | null) {
  return (
    status === DiaryEntryStatus.RECONCILED ||
    status === DiaryEntryStatus.RELEASED ||
    status === DiaryEntryStatus.ARCHIVED
  );
}

export async function PATCH(req: Request) {
  const denied = ensureAdmin(req);
  if (denied) return denied;
  const id = readId(req);
  if (!Number.isInteger(id) || id <= 0) {
    return adminJson({ code: 400, message: "条目 ID 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (body.status != null) {
    const status = normalizeStatus(body.status);
    if (!status) {
      return adminJson({ code: 400, message: "状态无效" }, { status: 400 });
    }
    patch.status = status;
    patch.settledAt = isResolvedStatus(status) ? new Date() : null;
  }
  if (body.isPinned != null) patch.isPinned = Boolean(body.isPinned);
  if (body.categoryId !== undefined) {
    const categoryId = Number(body.categoryId) || 0;
    patch.categoryId = categoryId > 0 ? categoryId : null;
  }

  const updated = await prisma.diaryEntry.update({
    where: { id },
    data: patch,
  });
  return adminJson({ code: 0, data: updated });
}
