"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";
import { DIARY_ENTRY_STATUS_OPTIONS } from "@/lib/diary-constants";

type Category = {
  id: number;
  name: string;
  color: string;
};

type EntryRow = {
  id: number;
  title: string;
  contentPreview: string;
  user: { id: number; nickname: string };
  category: Category | null;
  tags: Array<{ id: number; name: string; color: string }>;
  status: string;
  statusLabel: string;
  grievanceLevel: number;
  emotionLevel: number;
  followUpCount: number;
  isPinned: boolean;
  happenedAt: string;
  lastFollowUpAt: string;
  createdAt: string;
};

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
      : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export default function AdminEntriesPage() {
  const [list, setList] = React.useState<EntryRow[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [keyword, setKeyword] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [categoryId, setCategoryId] = React.useState("0");

  const load = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      limit: "20",
      status,
      categoryId,
      keyword: keyword.trim(),
    });

    Promise.all([
      adminApiFetch(`/api/admin/entries?${params.toString()}`, {
        headers: { ...authHeaders() },
      }).then((res) => res.json()),
      adminApiFetch("/api/admin/categories", {
        headers: { ...authHeaders() },
      }).then((res) => res.json()),
    ])
      .then(([entryJson, categoryJson]) => {
        setList(entryJson.data?.list ?? []);
        setCategories(categoryJson.data?.list ?? []);
      })
      .finally(() => setLoading(false));
  }, [categoryId, keyword, status]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function patchEntry(id: number, patch: Record<string, unknown>) {
    await adminApiFetch(`/api/admin/entries/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(patch),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">条目管理</h1>
        <p className="text-muted-foreground text-sm">
          用于查看用户都在记什么仇、情绪强度如何、是否已经和解或归档。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜标题、内容或用户"
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">全部状态</option>
            {DIARY_ENTRY_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="0">全部分类</option>
            {categories.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <Button onClick={load}>刷新</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">加载中…</CardContent>
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">暂无条目</CardContent>
          </Card>
        ) : (
          list.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      <Badge variant="secondary">{item.statusLabel}</Badge>
                      {item.isPinned ? <Badge>置顶</Badge> : null}
                    </div>
                    <p className="text-muted-foreground text-sm">{item.contentPreview}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>用户：{item.user.nickname}</span>
                      <span>分类：{item.category?.name ?? "未分类"}</span>
                      <span>发生时间：{formatDateTime(item.happenedAt)}</span>
                      <span>跟进次数：{item.followUpCount}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <select
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                      value={item.status}
                      onChange={(event) =>
                        void patchEntry(item.id, { status: event.target.value })
                      }
                    >
                      {DIARY_ENTRY_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                      value={String(item.category?.id ?? 0)}
                      onChange={(event) =>
                        void patchEntry(item.id, { categoryId: Number(event.target.value) || 0 })
                      }
                    >
                      <option value="0">未分类</option>
                      {categories.map((option) => (
                        <option key={option.id} value={String(option.id)}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      onClick={() => void patchEntry(item.id, { isPinned: !item.isPinned })}
                    >
                      {item.isPinned ? "取消置顶" : "设为置顶"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">记仇强度 {item.grievanceLevel}/5</Badge>
                  <Badge variant="outline">情绪强度 {item.emotionLevel}/5</Badge>
                  {item.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
