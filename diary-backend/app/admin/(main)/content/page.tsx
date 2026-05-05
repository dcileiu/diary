"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOk,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { randomWallpaperGroupCode } from "@/lib/wallpaper-group-code";
import { splitWallpaperTagsField } from "@/lib/wallpaper-tag-options";
import { adminApiFetch } from "@/lib/admin-client-fetch";
import { MAX_IMAGE_UPLOAD_MB } from "@/lib/upload-limits";

type Wall = {
  wallpapersId: number;
  groupCode: string;
  fileName: string;
  type: string;
  theme?: string;
  title: string;
  tags: string;
  hotScore?: number;
  /** 首页「每日精选」轮播 */
  dailyFeatured?: boolean;
  dailyFeaturedSort?: number;
  /** true：不在小程序展示 */
  hidden?: boolean;
};

type Category = { id: number; name: string; sortOrder: number };

type BatchRow = {
  key: string;
  file: File;
  fileName: string;
  previewUrl: string;
  title: string;
  tags: string;
  /** 与顶栏「组编号」同步，保存记录与单张重传时使用 */
  groupCode: string;
  /** 与顶栏「类型」同步，保存记录时使用 */
  type: string;
  /** 与顶栏「主题」同步，本批多图共用一个主题 */
  theme: string;
  phase: "local" | "uploading" | "uploaded" | "error";
  error?: string;
};

function authHeaders(): HeadersInit {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
      : null;
  const h: Record<string, string> = {};
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, "") || name;
}

function splitTypeField(input: string): string[] {
  return (input || "")
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinTypeField(parts: string[]): string {
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .join(",");
}

/** 部分系统/浏览器下 File.type 为空，仅靠 MIME 过滤会误丢弃合法图片 */
const IMAGE_NAME_EXT =
  /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif|ico|jfif)$/i;

function isLikelyImageFile(f: File): boolean {
  const t = (f.type || "").trim().toLowerCase();
  if (t.startsWith("image/")) return true;
  if (!t || t === "application/octet-stream") {
    return IMAGE_NAME_EXT.test(f.name);
  }
  return false;
}

/** 列表 / 预览用：与批量表格一致走同源 `/uploads/wallpapers/` */
function listWallpaperSrc(fileName: string) {
  return `/uploads/wallpapers/${encodeURIComponent(fileName)}`;
}

/** 列表小图：按需生成 WebP 缩略图，点击放大仍用 {@link listWallpaperSrc} */
function listWallpaperThumbSrc(fileName: string) {
  return `/api/public/wallpaper-thumb?f=${encodeURIComponent(fileName)}`;
}

function withAssetBase(assetBase: string | null | undefined, pathname: string) {
  const b = (assetBase || "").trim().replace(/\/$/, "");
  if (!b) return pathname;
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${b}${p}`;
}

function WallpaperTagBadges({
  tags,
  className,
}: {
  tags: string;
  className?: string;
}) {
  const parts = splitWallpaperTagsField(tags || "");
  if (!parts.length) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div
      className={cn("flex flex-wrap gap-1", className)}
      title={parts.join("，")}
    >
      {parts.map((t, i) => (
        <Badge key={`${i}-${t}`} variant="secondary" className="font-normal">
          {t}
        </Badge>
      ))}
    </div>
  );
}

/** 与 /api/admin/wallpapers?limit= 一致 */
const LIST_PAGE_SIZE = 10;

/** 批量队列上限（逐张上传，避免单次请求体过大导致 413） */
const BATCH_MAX_IMAGES = 100;

function formatUploadHttpError(
  status: number,
  j: { message?: string },
): string {
  if (status === 413) {
    if (j.message) return j.message;
    return `请求体过大(413)。单张上限 ${MAX_IMAGE_UPLOAD_MB}MB，请压缩图片或核对 Nginx client_max_body_size`;
  }
  if (j.message) return j.message;
  if (status) return `上传失败（HTTP ${status}）`;
  return "上传失败";
}

function CategoryMultiSelect({
  selected,
  onChange,
  categories,
  disabled,
  id,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  categories: Category[];
  disabled?: boolean;
  id?: string;
}) {
  const empty = !categories.length;
  const options = categories.map((c) => c.name);
  const label = empty
    ? "请先在「分类管理」添加类型"
    : selected.length
      ? `已选 ${selected.length} 项 · ${selected.join("、")}`
      : "请选择分类";

  function setChecked(name: string, checked: boolean) {
    if (checked) {
      onChange(joinTypeField([...selected, name]).split(",").filter(Boolean));
    } else {
      onChange(selected.filter((t) => t !== name));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled || empty}
        className={cn(
          "border-input bg-background flex h-9 w-full min-w-[140px] max-w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm shadow-xs",
          "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-(--anchor-width)">
        {options.map((name) => (
          <DropdownMenuCheckboxItem
            key={name}
            checked={selected.includes(name)}
            closeOnClick={false}
            onCheckedChange={(c) => setChecked(name, c)}
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TagMultiSelect({
  optionPool,
  selected,
  onChange,
  variant = "default",
  className,
  hint = true,
}: {
  optionPool: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  variant?: "default" | "compact";
  className?: string;
  hint?: boolean;
}) {
  const options = React.useMemo(() => {
    const s = new Set([...optionPool, ...selected]);
    return [...s].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [optionPool, selected]);

  function setChecked(tag: string, checked: boolean) {
    if (checked) {
      onChange(
        [...selected, tag].sort((a, b) => a.localeCompare(b, "zh-CN")),
      );
    } else {
      onChange(selected.filter((t) => t !== tag));
    }
  }

  const triggerLabel =
    selected.length === 0
      ? "点击选择标签…"
      : `已选 ${selected.length} 项 · ${selected.join("、")}`;

  const listMaxH = variant === "compact" ? "max-h-48" : "max-h-72";

  return (
    <div className={cn("space-y-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "border-input bg-background flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left shadow-xs",
            "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 touch-manipulation",
            variant === "compact"
              ? "h-8 py-0 text-xs"
              : "min-h-9 py-2 text-sm",
          )}
        >
          <span
            className="line-clamp-2 min-w-0 flex-1 leading-snug"
            title={selected.length ? selected.join("、") : undefined}
          >
            {triggerLabel}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            "min-w-(--anchor-width) max-w-[min(100vw-2rem,22rem)] overflow-y-auto p-1",
            listMaxH,
          )}
          align="start"
        >
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">
              请先在「标签管理」添加标签
            </p>
          ) : (
            options.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={selected.includes(t)}
                closeOnClick={false}
                onCheckedChange={(c) => setChecked(t, c)}
              >
                {t}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          点击展开列表，可多选；与顶栏组编号、类型、主题一样，修改后会同步本批全部行，表格内仍可单独改标签
        </p>
      ) : null}
    </div>
  );
}

export default function AdminContentPage() {
  const [list, setList] = React.useState<Wall[]>([]);
  const [listPage, setListPage] = React.useState(1);
  const [listTotal, setListTotal] = React.useState(0);
  const [assetBase, setAssetBase] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [batchRows, setBatchRows] = React.useState<BatchRow[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const dragDepth = React.useRef(0);

  const [sharedSelectedTags, setSharedSelectedTags] = React.useState<string[]>(
    [],
  );
  const [tagOptions, setTagOptions] = React.useState<string[]>([]);
  const [groupCode] = React.useState(randomWallpaperGroupCode);
  const [batchType, setBatchType] = React.useState("");
  const [batchTheme, setBatchTheme] = React.useState("");
  const [uploadingBatch, setUploadingBatch] = React.useState(false);
  const [savingBatch, setSavingBatch] = React.useState(false);
  const [batchUploadProgress, setBatchUploadProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);
  const batchRowsRef = React.useRef(batchRows);
  React.useEffect(() => {
    batchRowsRef.current = batchRows;
  }, [batchRows]);
  const [listImagePreview, setListImagePreview] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [noticeText, setNoticeText] = React.useState<string | null>(null);
  const [deleteWallpaperId, setDeleteWallpaperId] = React.useState<
    number | null
  >(null);
  const [batchEditType, setBatchEditType] = React.useState("");
  const [batchEditTheme, setBatchEditTheme] = React.useState("");
  const [batchEditSelectedTags, setBatchEditSelectedTags] = React.useState<
    string[]
  >([]);
  const [batchEditVisible, setBatchEditVisible] = React.useState<
    "keep" | "show" | "hide"
  >("keep");
  const [batchEditing, setBatchEditing] = React.useState(false);
  const [listVisibleFilter, setListVisibleFilter] = React.useState<
    "all" | "show" | "hide"
  >("all");
  const [listFeaturedFilter, setListFeaturedFilter] = React.useState<
    "all" | "featured" | "normal"
  >("all");
  const [selectedWallpaperIds, setSelectedWallpaperIds] = React.useState<
    number[]
  >([]);

  const showNotice = React.useCallback((message: string) => {
    setNoticeText(message);
  }, []);

  const filteredList = React.useMemo(() => {
    return list.filter((w) => {
      if (listVisibleFilter === "show" && (w.hidden ?? false)) return false;
      if (listVisibleFilter === "hide" && !(w.hidden ?? false)) return false;
      if (listFeaturedFilter === "featured" && !(w.dailyFeatured ?? false))
        return false;
      if (listFeaturedFilter === "normal" && (w.dailyFeatured ?? false))
        return false;
      return true;
    });
  }, [list, listFeaturedFilter, listVisibleFilter]);

  async function loadWallpapers(page: number) {
    const p = Math.max(1, page);
    setLoading(true);
    try {
      const visibleQ =
        listVisibleFilter === "all"
          ? ""
          : `&visible=${encodeURIComponent(listVisibleFilter)}`;
      const featuredQ =
        listFeaturedFilter === "all"
          ? ""
          : `&featured=${encodeURIComponent(listFeaturedFilter)}`;
      const res = await adminApiFetch(
        `/api/admin/wallpapers?page=${p}&limit=${LIST_PAGE_SIZE}${visibleQ}${featuredQ}`,
        {
          headers: { ...authHeaders() },
        },
      );
      const j = (await res.json()) as {
        code?: number;
        message?: string;
        data?: { list?: Wall[]; total?: number; page?: number; assetBase?: string };
      };
      if (j.code === 0 && j.data?.list) {
        if (j.data.assetBase) setAssetBase(String(j.data.assetBase));
        const rows = j.data.list.map((w) => ({
          ...w,
          dailyFeatured: w.dailyFeatured ?? false,
          dailyFeaturedSort: w.dailyFeaturedSort ?? 0,
          hidden: w.hidden ?? false,
        }));
        setList(rows);
        setListTotal(
          typeof j.data.total === "number" ? j.data.total : rows.length,
        );
        setListPage(typeof j.data.page === "number" ? j.data.page : p);
        setSelectedWallpaperIds((prev) =>
          prev.filter((id) => rows.some((w) => w.wallpapersId === id)),
        );
      } else if (j.code === 500 && j.message) showNotice(j.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await adminApiFetch("/api/admin/wallpaper-categories", {
        headers: { ...authHeaders() },
      });
      const j = (await res.json()) as {
        code?: number;
        data?: { list?: Category[] };
      };
      if (j.code === 0 && j.data?.list) {
        const list = j.data.list;
        setCategories(list);
        if (list.length) {
          const names = list.map((c) => c.name);
          setBatchType((t) => {
            const selected = splitTypeField(t).filter((x) => names.includes(x));
            if (selected.length) return joinTypeField(selected);
            return list[0]!.name;
          });
        } else {
          setBatchType("");
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function patchWallpaperRow(id: number, patch: Partial<Wall>) {
    try {
      const res = await adminApiFetch(`/api/admin/wallpapers/${id}`, {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const j = (await res.json()) as {
        code?: number;
        message?: string;
        data?: Wall;
      };
      if (j.code === 0 && j.data) {
        const row = {
          ...j.data,
          dailyFeatured: j.data.dailyFeatured ?? false,
          dailyFeaturedSort: j.data.dailyFeaturedSort ?? 0,
          hidden: j.data.hidden ?? false,
        };
        setList((prev) =>
          prev.map((w) => (w.wallpapersId === id ? { ...w, ...row } : w)),
        );
      } else {
        showNotice(j.message || "保存失败");
        void loadWallpapers(listPage);
      }
    } catch {
      showNotice("网络错误");
    }
  }

  async function patchWallpapersBatchByIds() {
    const uniqIds = [...new Set(selectedWallpaperIds)];
    if (!uniqIds.length) {
      showNotice("请先在列表中勾选要批量修改的图片");
      return;
    }
    const patch: Record<string, unknown> = {};
    if (batchEditType.trim()) patch.type = batchEditType.trim();
    patch.theme = batchEditTheme.trim();
    if (batchEditSelectedTags.length) {
      patch.tags = batchEditSelectedTags.join(",");
    }
    if (batchEditVisible !== "keep") patch.hidden = batchEditVisible === "hide";
    if (
      patch.type === undefined &&
      patch.tags === undefined &&
      batchEditVisible === "keep" &&
      batchEditTheme.trim() === ""
    ) {
      showNotice("请至少设置一项：分类、主题、标签或展示状态");
      return;
    }
    setBatchEditing(true);
    try {
      const res = await adminApiFetch("/api/admin/wallpapers/batch", {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: uniqIds,
          ...patch,
        }),
      });
      const j = (await res.json()) as {
        code?: number;
        message?: string;
        data?: { updatedCount?: number };
      };
      if (j.code === 0) {
        showNotice(`批量更新成功：${j.data?.updatedCount ?? 0} 条`);
        void loadWallpapers(listPage);
      } else {
        showNotice(j.message || "批量更新失败");
      }
    } catch {
      showNotice("网络错误");
    } finally {
      setBatchEditing(false);
    }
  }

  function toggleSelectedId(id: number, checked: boolean) {
    setSelectedWallpaperIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelectAllCurrentPage(checked: boolean) {
    if (!checked) {
      setSelectedWallpaperIds([]);
      return;
    }
    setSelectedWallpaperIds(list.map((w) => w.wallpapersId));
  }

  async function loadTagOptions() {
    try {
      const res = await adminApiFetch("/api/admin/wallpaper-tags", {
        headers: { ...authHeaders() },
      });
      const j = (await res.json()) as {
        code?: number;
        data?: { list?: { name: string }[] };
      };
      if (j.code === 0 && j.data?.list)
        setTagOptions(j.data.list.map((t) => t.name));
    } catch {
      /* ignore */
    }
  }

  React.useEffect(() => {
    void loadWallpapers(1);
    loadCategories();
    loadTagOptions();
  }, []);

  React.useEffect(() => {
    void loadWallpapers(1);
  }, [listVisibleFilter, listFeaturedFilter]);

  React.useEffect(() => {
    if (!listImagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListImagePreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listImagePreview]);

  /** 顶栏默认标签 / 组编号 / 类型 / 主题 变更时同步到当前批次全部行 */
  React.useEffect(() => {
    const t = sharedSelectedTags.join(",");
    setBatchRows((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((r) => ({
        ...r,
        tags: t,
        groupCode,
        type: batchType,
        theme: batchTheme,
      }));
    });
  }, [sharedSelectedTags, groupCode, batchType, batchTheme]);

  function pushImageFiles(fileList: FileList | File[]) {
    const raw = Array.from(fileList);
    const files = raw.filter(isLikelyImageFile);
    if (!files.length) {
      if (raw.length > 0) {
        showNotice(
          "未能识别为图片文件（本机有时不返回类型信息）。请尽量选 JPG/PNG/WebP 等；若扩展名正确仍失败，可把文件先另存为标准 JPG 再试。",
        );
      }
      return;
    }
    setBatchRows((prev) => {
      const remaining = BATCH_MAX_IMAGES - prev.length;
      if (remaining <= 0) {
        showNotice(
          `队列最多 ${BATCH_MAX_IMAGES} 张，请先上传完成或移除后再添加`,
        );
        return prev;
      }
      const slice = files.slice(0, remaining);
      if (slice.length < files.length) {
        showNotice(
          `仅加入前 ${slice.length} 张，队列上限为 ${BATCH_MAX_IMAGES} 张`,
        );
      }
      return [
        ...prev,
        ...slice.map((file) => ({
          key: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          file,
          fileName: "",
          previewUrl: URL.createObjectURL(file),
          title: stripExt(file.name),
          tags: sharedSelectedTags.join(","),
          groupCode,
          type: batchType,
          theme: batchTheme,
          phase: "local" as const,
        })),
      ];
    });
  }

  function removeBatchRow(key: string) {
    setBatchRows((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.key !== key);
    });
  }

  function updateBatchRow(key: string, patch: Partial<BatchRow>) {
    setBatchRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function parseUploadResponse(j: {
    code?: number;
    data?: {
      fileName?: string;
      files?: { fileName: string; url?: string }[];
    };
  }): { fileName: string }[] | null {
    if (j.code !== 0 || !j.data) return null;
    const list = j.data.files;
    if (list?.length) return list.map((x) => ({ fileName: x.fileName }));
    const one = j.data.fileName;
    if (one) return [{ fileName: one }];
    return null;
  }

  /** 单条写入壁纸记录（不切换「保存中」全局状态，供批处理外层统一包一层） */
  async function persistSingleRowToDb(row: BatchRow): Promise<boolean> {
    const gc = row.groupCode.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{4,6}$/.test(gc)) {
      showNotice(`组编号须为 4～6 位数字（${row.fileName || row.file.name}）`);
      return false;
    }
    const ty = row.type.trim();
    if (!ty) {
      showNotice("请先在「分类管理」添加并选择类型");
      return false;
    }
    if (!row.fileName.trim()) {
      showNotice(`缺少 fileName，无法保存记录：${row.file.name}`);
      return false;
    }
    if (!row.title.trim() || !row.tags.trim()) {
      showNotice(`请填写标题与标签：${row.file.name}`);
      return false;
    }
    const res = await adminApiFetch("/api/admin/wallpapers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        fileName: row.fileName.trim(),
        type: ty,
        theme: row.theme.trim(),
        title: row.title.trim(),
        tags: row.tags.trim(),
        groupCode: gc,
      }),
    });
    const j = (await res.json()) as { code?: number };
    if (j.code !== 0) {
      showNotice(`保存记录失败：${row.fileName}`);
      return false;
    }
    return true;
  }

  /** 将已拿到 fileName 的行批量保存为壁纸记录 */
  async function persistUploadedRowsToDb(rows: BatchRow[]): Promise<boolean> {
    if (!rows.length) return true;
    setSavingBatch(true);
    try {
      for (const row of rows) {
        const ok = await persistSingleRowToDb(row);
        if (!ok) return false;
      }
      return true;
    } finally {
      setSavingBatch(false);
    }
  }

  /** 单张上传到磁盘（独立请求，避免多图合一触发 413） */
  async function uploadSingleToDisk(
    row: BatchRow,
    gc: string,
  ): Promise<
    { ok: true; fileName: string } | { ok: false; error: string }
  > {
    const fd = new FormData();
    fd.set("groupCode", gc);
    fd.append("file", row.file);
    const res = await adminApiFetch("/api/admin/wallpapers/upload", {
      method: "POST",
      headers: { ...authHeaders() },
      body: fd,
    });
    let j: Parameters<typeof parseUploadResponse>[0] & { message?: string } =
      {};
    try {
      j = (await res.json()) as typeof j;
    } catch {
      /* 非 JSON 响应 */
    }
    if (!res.ok) {
      return { ok: false, error: formatUploadHttpError(res.status, j) };
    }
    const parsed = parseUploadResponse(j);
    const fileName = parsed?.[0]?.fileName;
    if (!fileName) {
      return {
        ok: false,
        error: j.message ?? "上传失败（无 fileName）",
      };
    }
    return { ok: true, fileName };
  }

  /**
   * 逐张上传并立即写库；已成功会从队列移除。
   * 失败行保留为「失败」或「已上传未入库」，可再次点击主按钮续传（仅重试未完成项）。
   */
  async function uploadAllPending() {
    const pending = batchRows.filter(
      (r) => r.phase === "local" || r.phase === "error",
    );
    if (!pending.length) return;

    const topGc = groupCode.trim();
    if (!/^\d{4,6}$/.test(topGc)) {
      showNotice("组编号须为 4～6 位数字，上传后文件名会按「组编号_时间戳」生成");
      return;
    }
    for (const row of pending) {
      const latest =
        batchRowsRef.current.find((r) => r.key === row.key) ?? row;
      const rowGc = latest.groupCode.replace(/\D/g, "").slice(0, 6);
      if (!/^\d{4,6}$/.test(rowGc)) {
        showNotice(`组编号须为 4～6 位数字（${latest.file.name}）`);
        return;
      }
      if (!latest.type.trim()) {
        showNotice(`请选择类型：${latest.file.name}`);
        return;
      }
      if (!latest.title.trim() || !latest.tags.trim()) {
        showNotice(`请填写标题与标签：${latest.file.name}`);
        return;
      }
    }

    setUploadingBatch(true);
    try {
      for (let i = 0; i < pending.length; i += 1) {
        const snap = pending[i]!;
        setBatchUploadProgress({
          current: i + 1,
          total: pending.length,
        });
        if (!batchRowsRef.current.some((r) => r.key === snap.key)) {
          continue;
        }
        const latest =
          batchRowsRef.current.find((r) => r.key === snap.key) ?? snap;
        if (
          latest.phase !== "local" &&
          latest.phase !== "error"
        ) {
          continue;
        }

        const rowGc = latest.groupCode.replace(/\D/g, "").slice(0, 6);

        updateBatchRow(latest.key, { phase: "uploading", error: undefined });

        let uploadResult: Awaited<ReturnType<typeof uploadSingleToDisk>>;
        try {
          uploadResult = await uploadSingleToDisk(latest, rowGc);
        } catch {
          updateBatchRow(latest.key, {
            phase: "error",
            error: "网络异常，可再次点击按钮续传",
          });
          continue;
        }

        if (!uploadResult.ok) {
          updateBatchRow(latest.key, {
            phase: "error",
            error: uploadResult.error,
          });
          continue;
        }

        const fileName = uploadResult.fileName;
        updateBatchRow(latest.key, {
          phase: "uploaded",
          fileName,
          error: undefined,
        });

        const merged =
          batchRowsRef.current.find((r) => r.key === latest.key) ?? latest;
        const rowForDb: BatchRow = {
          ...merged,
          phase: "uploaded",
          fileName,
        };

        setSavingBatch(true);
        let persisted = false;
        try {
          persisted = await persistSingleRowToDb(rowForDb);
        } finally {
          setSavingBatch(false);
        }

        if (persisted) {
          URL.revokeObjectURL(latest.previewUrl);
          // 与 setState 同步更新 ref，避免 onConfirmUploadAndPersist 里 setTimeout(0) 读到旧 ref，
          // 把「已入库且已从队列移除」的最后一行误判为 stuck 再 POST 一次（重复记录）。
          batchRowsRef.current = batchRowsRef.current.filter(
            (r) => r.key !== latest.key,
          );
          setBatchRows((prev) => prev.filter((r) => r.key !== latest.key));
          void loadWallpapers(1);
        }
      }
    } finally {
      setUploadingBatch(false);
      setBatchUploadProgress(null);
      loadTagOptions();
    }
  }

  /** 上传已成功但保存记录失败时，仅写记录（不重新传文件） */
  async function retryPersistStuckRowsWithList(stuck: BatchRow[]) {
    if (!stuck.length) return;
    const dbOk = await persistUploadedRowsToDb(stuck);
    if (dbOk) {
      const keys = new Set(stuck.map((s) => s.key));
      for (const r of stuck) {
        URL.revokeObjectURL(r.previewUrl);
      }
      batchRowsRef.current = batchRowsRef.current.filter((r) => !keys.has(r.key));
      setBatchRows((prev) => prev.filter((r) => !keys.has(r.key)));
      void loadWallpapers(1);
      loadTagOptions();
    }
  }

  async function retryPersistStuckRows() {
    const stuck = batchRows.filter(
      (r) => r.phase === "uploaded" && r.fileName,
    );
    await retryPersistStuckRowsWithList(stuck);
  }

  async function onConfirmUploadAndPersist() {
    if (
      batchRows.some(
        (r) => r.phase === "local" || r.phase === "error",
      )
    ) {
      await uploadAllPending();
      // 让 React 提交队列状态后再读 ref，避免「刚上传完」与「待写库」同一轮点击漏掉 stuck
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    const stuckAfter = batchRowsRef.current.filter(
      (r) => r.phase === "uploaded" && r.fileName,
    );
    await retryPersistStuckRowsWithList(stuckAfter);
  }

  function requestRemoveWallpaper(id: number) {
    setDeleteWallpaperId(id);
  }

  async function confirmDeleteWallpaper() {
    if (deleteWallpaperId == null) return;
    const id = deleteWallpaperId;
    setDeleteWallpaperId(null);
    await adminApiFetch(`/api/admin/wallpapers/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    const lastOnPage = list.length <= 1;
    const nextPage =
      lastOnPage && listPage > 1 ? listPage - 1 : listPage;
    void loadWallpapers(nextPage);
  }

  const listTotalPages = Math.max(1, Math.ceil(listTotal / LIST_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          内容管理
        </h1>
        <p className="text-muted-foreground text-sm">
          组编号（groupCode）为 4～6 位数字，由系统随机生成并锁定；顶栏的<strong className="text-foreground">类型、主题、默认标签</strong>在修改后会自动同步到本批全部队列行（表格内可单独改标题与标签）。主题表示本批图片的同一主题，保存为壁纸记录时每条都会写入。保存到磁盘的文件名由服务端按当前组编号生成。队列最多{" "}
          <strong className="text-foreground">{BATCH_MAX_IMAGES}</strong>{" "}
          张。<strong className="text-foreground">选择或拖入图片不会立即上传</strong>
          ，核对后点击「确认上传并记录」：
          <strong className="text-foreground">
            单张不超过 {MAX_IMAGE_UPLOAD_MB}MB；按队列逐张上传，每张成功后立即写入记录
          </strong>
          ；中途失败可再次点击同一按钮，仅重试未完成项（已成功的不会重复传）。
          图片保存到{" "}
          <code className="text-xs">public/uploads/wallpapers/</code>。
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/admin/categories"
            className="text-primary underline-offset-4 hover:underline"
          >
            分类（类型）管理 →
          </Link>
          <Link
            href="/admin/tags"
            className="text-primary underline-offset-4 hover:underline"
          >
            标签管理 →
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">批量上传</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "relative rounded-lg border-2 border-dashed p-5 text-center text-sm transition-colors touch-manipulation sm:p-8",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragDepth.current += 1;
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) {
                dragDepth.current = 0;
                setDragOver(false);
              }
            }}
            onDragOverCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDropCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragDepth.current = 0;
              setDragOver(false);
              const dt = e.dataTransfer;
              if (dt?.files?.length) pushImageFiles(dt.files);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("batch-file-input")?.click();
              }
            }}
          >
            <p className="pointer-events-none text-muted-foreground">
              将图片拖放到此处，或
            </p>
            <input
              id="batch-file-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                const picked: File[] = input.files?.length
                  ? [...input.files]
                  : [];
                input.value = "";
                if (picked.length) pushImageFiles(picked);
              }}
            />
            <div className="pointer-events-auto relative z-10 mt-3 inline-block w-full max-w-xs sm:mt-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="min-h-11 w-full touch-manipulation sm:min-h-9"
                onClick={() =>
                  document.getElementById("batch-file-input")?.click()
                }
              >
                选择图片（可多选）
              </Button>
            </div>
          </div>

          {batchRows.some(
            (r) => r.phase === "uploading" || r.phase === "error",
          ) && (
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  上传进度与结果
                </div>
                {uploadingBatch && batchUploadProgress ? (
                  <p className="text-muted-foreground text-xs leading-snug">
                    第 {batchUploadProgress.current} /{" "}
                    {batchUploadProgress.total}{" "}
                    张：逐张上传并写库；断网或失败后再次点击主按钮可续传未完成项。
                  </p>
                ) : null}
                <div className="space-y-2">
                  {batchRows
                    .filter((r) => r.phase === "uploading")
                    .map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 shadow-xs"
                      >
                        <Loader2Icon
                          className="size-8 shrink-0 animate-spin text-primary"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-primary">
                            {r.file.name}
                          </p>
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full w-2/5 animate-pulse rounded-full bg-primary/80" />
                          </div>
                        </div>
                      </div>
                    ))}
                  {batchRows
                    .filter((r) => r.phase === "error")
                    .map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center gap-3 rounded-lg border-2 border-destructive/55 bg-destructive/5 px-3 py-2.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.previewUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-14 shrink-0 rounded-md border border-destructive/30 object-cover opacity-80"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-destructive">
                            {r.file.name}
                          </p>
                          <p className="text-destructive/90 mt-0.5 text-xs">
                            {r.error ?? "上传失败"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                          title="移除"
                          onClick={() => removeBatchRow(r.key)}
                        >
                          <Trash2Icon className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
            <div className="space-y-1.5 w-full sm:w-auto">
              <Label>组编号</Label>
              <Input
                className="w-28 font-mono bg-muted text-muted-foreground"
                inputMode="numeric"
                value={groupCode}
                disabled
                readOnly
                title="系统随机生成，当前不可修改"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-auto sm:min-w-[180px]">
              <Label htmlFor="batch-type-select">类型</Label>
              <CategoryMultiSelect
                id="batch-type-select"
                selected={splitTypeField(batchType)}
                onChange={(next) => setBatchType(joinTypeField(next))}
                categories={categories}
                disabled={!categories.length}
              />
            </div>
            <div className="space-y-1.5 w-full sm:min-w-[200px] sm:max-w-xs">
              <Label htmlFor="batch-theme-input">主题</Label>
              <Input
                id="batch-theme-input"
                placeholder="如：春日樱花、赛博朋克"
                value={batchTheme}
                onChange={(e) => setBatchTheme(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 w-full flex-1 sm:min-w-[220px] sm:max-w-md">
              <Label>默认标签</Label>
              <TagMultiSelect
                optionPool={tagOptions}
                selected={sharedSelectedTags}
                onChange={setSharedSelectedTags}
              />
            </div>
          </div>

          {batchRows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  size="default"
                  className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
                  disabled={
                    uploadingBatch ||
                    savingBatch ||
                    (!batchRows.some(
                      (r) => r.phase === "local" || r.phase === "error",
                    ) &&
                      !batchRows.some(
                        (r) => r.phase === "uploaded" && r.fileName,
                      ))
                  }
                  onClick={() => void onConfirmUploadAndPersist()}
                >
                  {uploadingBatch
                    ? batchUploadProgress
                      ? `上传并记录（${batchUploadProgress.current}/${batchUploadProgress.total}）…`
                      : "上传并记录…"
                    : savingBatch
                      ? "保存记录中…"
                      : batchRows.some(
                            (r) =>
                              r.phase === "local" || r.phase === "error",
                          )
                        ? "确认上传并记录（逐张·可续传）"
                        : "重试保存记录（文件已在服务器）"}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border touch-pan-x overscroll-x-contain">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="p-2 font-medium w-14">预览</th>
                      <th className="p-2 font-medium w-20 whitespace-nowrap">
                        组编号
                      </th>
                      <th className="p-2 font-medium min-w-[72px]">类型</th>
                      <th className="p-2 font-medium min-w-[100px]">主题</th>
                      <th className="p-2 font-medium min-w-[120px]">标题</th>
                      <th className="p-2 font-medium min-w-[140px]">标签</th>
                      <th className="p-2 font-medium min-w-[160px]">fileName</th>
                      <th className="p-2 font-medium w-24">状态</th>
                      <th className="p-2 font-medium w-16">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRows.map((r) => (
                      <tr key={r.key} className="border-b border-border/60">
                        <td className="p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              r.fileName
                                ? withAssetBase(
                                    assetBase,
                                    `/uploads/wallpapers/${encodeURIComponent(r.fileName)}?imageView2/2/w/360/q/72/format/webp`,
                                  )
                                : r.previewUrl
                            }
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-12 w-12 rounded object-cover border"
                          />
                        </td>
                        <td className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {r.groupCode.replace(/\D/g, "").slice(0, 6) || "—"}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[100px] truncate" title={r.type || ""}>
                          {r.type || "—"}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[120px] truncate" title={r.theme || ""}>
                          {r.theme.trim() || "—"}
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={r.title}
                            onChange={(e) =>
                              updateBatchRow(r.key, { title: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-2 align-top min-w-[140px] max-w-[200px]">
                          <TagMultiSelect
                            optionPool={tagOptions}
                            selected={splitWallpaperTagsField(r.tags)}
                            onChange={(tags) =>
                              updateBatchRow(r.key, { tags: tags.join(",") })
                            }
                            variant="compact"
                            hint={false}
                          />
                        </td>
                        <td className="p-2 font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={r.fileName}>
                          {r.fileName || "—"}
                        </td>
                        <td className="p-2 text-xs">
                          {r.phase === "local" && "待上传"}
                          {r.phase === "uploading" && "上传中"}
                          {r.phase === "uploaded" &&
                            (savingBatch ? "保存记录中…" : "已上传")}
                          {r.phase === "error" && (
                            <span className="text-destructive">
                              {r.error ?? "失败"}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeBatchRow(r.key)}
                          >
                            移除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base">列表（已有记录）</CardTitle>
            <p className="text-muted-foreground text-xs font-normal leading-snug">
              此处仅展示已保存的壁纸记录，每页 {LIST_PAGE_SIZE}{" "}
              条（按记录 id 倒序）。勾选<strong className="text-foreground">每日精选</strong>
              后，该图会进入小程序首页轮播（按「顺序」升序）；未勾选任何精选时，轮播仍沿用「手机壁纸」前几条作为兜底。
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 touch-manipulation sm:min-h-9"
            onClick={() => {
              void loadWallpapers(listPage);
              loadTagOptions();
            }}
          >
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label>小程序展示筛选</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="border-input bg-background flex h-9 min-w-[160px] items-center justify-between rounded-md border px-3 text-sm">
                  {listVisibleFilter === "all"
                    ? "全部"
                    : listVisibleFilter === "show"
                      ? "仅显示中"
                      : "仅未显示"}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-(--anchor-width)">
                  <DropdownMenuRadioGroup
                    value={listVisibleFilter}
                    onValueChange={(v) =>
                      setListVisibleFilter(v as "all" | "show" | "hide")
                    }
                  >
                    <DropdownMenuRadioItem value="all">全部</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="show">仅显示中</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hide">仅未显示</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1.5">
              <Label>精选筛选</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="border-input bg-background flex h-9 min-w-[160px] items-center justify-between rounded-md border px-3 text-sm">
                  {listFeaturedFilter === "all"
                    ? "全部"
                    : listFeaturedFilter === "featured"
                      ? "仅精选"
                      : "仅非精选"}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-(--anchor-width)">
                  <DropdownMenuRadioGroup
                    value={listFeaturedFilter}
                    onValueChange={(v) =>
                      setListFeaturedFilter(
                        v as "all" | "featured" | "normal",
                      )
                    }
                  >
                    <DropdownMenuRadioItem value="all">全部</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="featured">仅精选</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="normal">仅非精选</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-muted-foreground text-xs">
              当前查询结果：本页 {list.length} 条（共 {listTotal} 条）
            </p>
          </div>
          <div className="mb-4 grid gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2">
              <Label>批量编辑（先勾选左侧复选框）</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  已选 {selectedWallpaperIds.length} 张
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedWallpaperIds([])}
                  disabled={selectedWallpaperIds.length === 0}
                >
                  清空勾选
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>分类（可选）</Label>
              <CategoryMultiSelect
                selected={splitTypeField(batchEditType)}
                onChange={(next) => setBatchEditType(joinTypeField(next))}
                categories={categories}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-edit-theme">主题（可选）</Label>
              <Input
                id="batch-edit-theme"
                value={batchEditTheme}
                onChange={(e) => setBatchEditTheme(e.target.value)}
                placeholder="留空则清空主题"
              />
            </div>
            <div className="space-y-1.5">
              <Label>标签（可选）</Label>
              <TagMultiSelect
                optionPool={tagOptions}
                selected={batchEditSelectedTags}
                onChange={setBatchEditSelectedTags}
                variant="compact"
                hint={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>小程序展示</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="border-input bg-background flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm">
                  {batchEditVisible === "keep"
                    ? "保持不变"
                    : batchEditVisible === "show"
                      ? "设为展示"
                      : "设为隐藏"}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-(--anchor-width)">
                  <DropdownMenuRadioGroup
                    value={batchEditVisible}
                    onValueChange={(v) =>
                      setBatchEditVisible(v as "keep" | "show" | "hide")
                    }
                  >
                    <DropdownMenuRadioItem value="keep">保持不变</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="show">设为展示</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="hide">设为隐藏</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                type="button"
                onClick={() => {
                  void patchWallpapersBatchByIds();
                }}
                disabled={batchEditing}
              >
                {batchEditing ? "批量更新中…" : "批量应用到已勾选图片"}
              </Button>
            </div>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : (
            <>
              {filteredList.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  暂无符合筛选条件的记录
                </p>
              ) : (
                <>
              <div className="space-y-3 sm:hidden">
                {filteredList.map((w) => (
                  <Card
                    key={w.wallpapersId}
                    className={cn("shadow-none", w.hidden && "border-dashed opacity-80")}
                  >
                    <CardContent className="space-y-2 p-4 text-sm">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selectedWallpaperIds.includes(w.wallpapersId)}
                          onChange={(e) =>
                            toggleSelectedId(w.wallpapersId, e.target.checked)
                          }
                        />
                        选中用于批量编辑
                      </label>
                      <button
                        type="button"
                        className="relative block w-full max-w-[220px] overflow-hidden rounded-lg border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          setListImagePreview({
                            src: withAssetBase(assetBase, listWallpaperSrc(w.fileName)),
                            alt: w.title || w.fileName,
                          })
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={withAssetBase(
                            assetBase,
                            `/uploads/wallpapers/${encodeURIComponent(w.fileName)}?imageView2/2/w/360/q/72/format/webp`,
                          )}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <span className="sr-only">点击放大查看</span>
                      </button>
                      <div className="flex gap-3">
                        <div className="text-muted-foreground text-xs tabular-nums">
                          #{w.wallpapersId}
                        </div>
                        <div className="font-mono text-xs">{w.groupCode}</div>
                      </div>
                      <div className="font-medium">{w.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {w.type}
                        {w.theme ? ` · ${w.theme}` : ""}
                      </div>
                      <WallpaperTagBadges tags={w.tags} />
                      <p className="break-all font-mono text-xs">{w.fileName}</p>
                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={w.dailyFeatured ?? false}
                            onChange={(e) => {
                              void patchWallpaperRow(w.wallpapersId, {
                                dailyFeatured: e.target.checked,
                              });
                            }}
                          />
                          每日精选（首页轮播）
                        </label>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">顺序</span>
                          <Input
                            type="number"
                            min={0}
                            max={9999}
                            className="h-8 w-[4.5rem] text-center text-xs tabular-nums"
                            disabled={!(w.dailyFeatured ?? false)}
                            key={`${w.wallpapersId}-mob-sort-${w.dailyFeaturedSort}-${w.dailyFeatured ? 1 : 0}`}
                            defaultValue={
                              w.dailyFeatured && (w.dailyFeaturedSort ?? 0) > 0
                                ? String(w.dailyFeaturedSort)
                                : ""
                            }
                            onBlur={(ev) => {
                              if (!(w.dailyFeatured ?? false)) return;
                              const raw = ev.currentTarget.value.trim();
                              const v = parseInt(raw, 10);
                              if (raw === "" || !Number.isFinite(v)) return;
                              const clamped = Math.max(0, Math.min(9999, v));
                              if (clamped === (w.dailyFeaturedSort ?? 0)) return;
                              void patchWallpaperRow(w.wallpapersId, {
                                dailyFeaturedSort: clamped,
                              });
                            }}
                          />
                        </div>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={!(w.hidden ?? false)}
                          title="取消勾选则小程序用户看不到此图"
                          onChange={(e) => {
                            void patchWallpaperRow(w.wallpapersId, {
                              hidden: !e.target.checked,
                            });
                          }}
                        />
                        在小程序展示
                      </label>
                      <Button
                        variant="outline"
                        size="default"
                        className="w-full min-h-11 text-destructive touch-manipulation hover:text-destructive"
                        onClick={() => requestRemoveWallpaper(w.wallpapersId)}
                      >
                        删除
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="hidden overflow-x-auto touch-pan-x overscroll-x-contain sm:block">
                <table className="w-full min-w-[1160px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium w-10 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={
                            list.length > 0 &&
                            list.every((w) =>
                              selectedWallpaperIds.includes(w.wallpapersId),
                            )
                          }
                          onChange={(e) =>
                            toggleSelectAllCurrentPage(e.target.checked)
                          }
                          title="全选当前页"
                        />
                      </th>
                      <th className="pb-2 pr-3 font-medium w-16">预览</th>
                      <th className="pb-2 pr-2 font-medium w-14 text-center">
                        精选
                      </th>
                      <th className="pb-2 pr-3 font-medium w-20 text-center">
                        顺序
                      </th>
                      <th
                        className="pb-2 pr-3 font-medium w-24 text-center"
                        title="勾选=在小程序展示；上传默认展示"
                      >
                        小程序
                      </th>
                      <th className="pb-2 pr-3 font-medium">组编号</th>
                      <th className="pb-2 pr-3 font-medium">记录 ID</th>
                      <th className="pb-2 pr-3 font-medium">类型</th>
                      <th className="pb-2 pr-3 font-medium">主题</th>
                      <th className="pb-2 pr-3 font-medium">标题</th>
                      <th className="pb-2 pr-3 font-medium">标签</th>
                      <th className="pb-2 pr-3 font-medium max-w-[280px]">
                        fileName
                      </th>
                      <th className="pb-2 font-medium w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((w) => (
                      <tr
                        key={w.wallpapersId}
                        className={cn(
                          "border-b border-border/60",
                          w.hidden && "bg-muted/20",
                        )}
                      >
                        <td className="py-2 pr-3 align-middle text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selectedWallpaperIds.includes(w.wallpapersId)}
                            onChange={(e) =>
                              toggleSelectedId(w.wallpapersId, e.target.checked)
                            }
                          />
                        </td>
                        <td className="py-2 pr-3 align-middle">
                          <button
                            type="button"
                            className="group relative block shrink-0 overflow-hidden rounded-md border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() =>
                              setListImagePreview({
                                src: withAssetBase(assetBase, listWallpaperSrc(w.fileName)),
                                alt: w.title || w.fileName,
                              })
                            }
                            title="点击放大"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={withAssetBase(
                                assetBase,
                                `/uploads/wallpapers/${encodeURIComponent(w.fileName)}?imageView2/2/w/360/q/72/format/webp`,
                              )}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-12 w-12 object-cover transition-opacity group-hover:opacity-90"
                            />
                            <span className="sr-only">放大查看 {w.title}</span>
                          </button>
                        </td>
                        <td className="py-2 pr-2 align-middle text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={w.dailyFeatured ?? false}
                            title="每日精选轮播"
                            onChange={(e) => {
                              void patchWallpaperRow(w.wallpapersId, {
                                dailyFeatured: e.target.checked,
                              });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 align-middle text-center">
                          <Input
                            type="number"
                            min={0}
                            max={9999}
                            className="mx-auto h-8 w-16 text-center text-xs tabular-nums"
                            disabled={!(w.dailyFeatured ?? false)}
                            title="数字越小越靠前"
                            key={`${w.wallpapersId}-tbl-sort-${w.dailyFeaturedSort}-${w.dailyFeatured ? 1 : 0}`}
                            defaultValue={
                              w.dailyFeatured && (w.dailyFeaturedSort ?? 0) > 0
                                ? String(w.dailyFeaturedSort)
                                : ""
                            }
                            onBlur={(ev) => {
                              if (!(w.dailyFeatured ?? false)) return;
                              const raw = ev.currentTarget.value.trim();
                              const v = parseInt(raw, 10);
                              if (raw === "" || !Number.isFinite(v)) return;
                              const clamped = Math.max(0, Math.min(9999, v));
                              if (clamped === (w.dailyFeaturedSort ?? 0)) return;
                              void patchWallpaperRow(w.wallpapersId, {
                                dailyFeaturedSort: clamped,
                              });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 align-middle text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={!(w.hidden ?? false)}
                            title="取消勾选则小程序用户看不到此图"
                            onChange={(e) => {
                              void patchWallpaperRow(w.wallpapersId, {
                                hidden: !e.target.checked,
                              });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono">{w.groupCode}</td>
                        <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                          {w.wallpapersId}
                        </td>
                        <td className="py-2 pr-3">{w.type}</td>
                        <td className="py-2 pr-3 max-w-[140px] truncate" title={w.theme || ""}>
                          {w.theme || "—"}
                        </td>
                        <td className="py-2 pr-3">{w.title}</td>
                        <td className="py-2 pr-3 max-w-[240px] align-top">
                          <WallpaperTagBadges tags={w.tags} />
                        </td>
                        <td className="py-2 pr-3 truncate max-w-[280px]" title={w.fileName}>
                          {w.fileName}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => requestRemoveWallpaper(w.wallpapersId)}
                          >
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm tabular-nums">
                  共 {listTotal} 条，每页 {LIST_PAGE_SIZE} 条
                  {listTotalPages > 1
                    ? ` · 第 ${listPage} / ${listTotalPages} 页`
                    : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 touch-manipulation sm:min-h-9"
                    disabled={listPage <= 1}
                    onClick={() => void loadWallpapers(listPage - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 touch-manipulation sm:min-h-9"
                    disabled={listPage >= listTotalPages}
                    onClick={() => void loadWallpapers(listPage + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={noticeText != null}
        onOpenChange={(open) => {
          if (!open) setNoticeText(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提示</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {noticeText ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogOk />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteWallpaperId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteWallpaperId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除壁纸</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该壁纸？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDeleteWallpaper()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {listImagePreview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px]"
          onClick={() => setListImagePreview(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-[101] rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md hover:bg-background touch-manipulation"
            onClick={() => setListImagePreview(null)}
          >
            关闭（Esc）
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listImagePreview.src}
            alt={listImagePreview.alt}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="max-h-[min(92vh,100%)] max-w-full cursor-default object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
