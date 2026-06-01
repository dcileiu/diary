"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

const PAGE_SIZE = 20;

type Row = {
  id: number;
  nickname: string;
  bio: string;
  totalEntryCount: number;
  activeEntryCount: number;
  resolvedEntryCount: number;
  lastEntryAt: string;
  createdAt: string;
};

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export default function AdminUsersPage() {
  const [list, setList] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (!token) return;
    setLoading(true);
    adminApiFetch(`/api/admin/users?page=${page}&limit=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        setList(json.data?.list ?? []);
        setTotal(json.data?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">用户</h1>
        <p className="text-muted-foreground text-sm">
          这里看的是小程序真实用户以及他们的记仇行为总量，不再是下载或收藏数据。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">用户列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无用户</p>
          ) : (
            <div className="grid gap-4">
              {list.map((item) => (
                <Card key={item.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.nickname}</h2>
                        <p className="text-muted-foreground text-sm">{item.bio || "暂无简介"}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        注册于 {formatDateTime(item.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span>总条目 {item.totalEntryCount}</span>
                      <span>未放下 {item.activeEntryCount}</span>
                      <span>已解决 {item.resolvedEntryCount}</span>
                      <span>最近记录 {formatDateTime(item.lastEntryAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {total > 0 ? (
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-muted-foreground text-sm">
                共 {total} 位用户 · 第 {page}/{totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
