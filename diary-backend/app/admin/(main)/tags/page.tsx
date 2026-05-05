"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

type Row = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  entryCount: number;
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

export default function AdminTagsPage() {
  const [list, setList] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState({
    name: "",
    color: "#577590",
    sortOrder: "0",
  });

  const load = React.useCallback(() => {
    setLoading(true);
    adminApiFetch("/api/admin/tags", {
      headers: { ...authHeaders() },
    })
      .then((res) => res.json())
      .then((json) => setList(json.data?.list ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createTag() {
    await adminApiFetch("/api/admin/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        ...draft,
        sortOrder: Number(draft.sortOrder) || 0,
      }),
    });
    setDraft({ name: "", color: "#577590", sortOrder: "0" });
    load();
  }

  async function updateTag(item: Row) {
    await adminApiFetch(`/api/admin/tags/${item.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(item),
    });
    load();
  }

  async function removeTag(id: number) {
    await adminApiFetch(`/api/admin/tags/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    load();
  }

  return (
    <div className="mx-auto max-w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">标签管理</h1>
        <p className="text-muted-foreground text-sm">
          标签用于表达更细的仇点，比如甩锅、爽约、翻旧账、冷暴力。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增标签</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="标签名称"
          />
          <Input
            value={draft.color}
            onChange={(event) => setDraft((prev) => ({ ...prev, color: event.target.value }))}
            placeholder="#577590"
          />
          <Input
            value={draft.sortOrder}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))
            }
            placeholder="排序"
          />
          <Button onClick={() => void createTag()}>新增</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">加载中…</CardContent>
          </Card>
        ) : (
          list.map((item) => (
            <Card key={item.id}>
              <CardContent className="grid gap-3 p-5 md:grid-cols-[1.5fr_1fr_0.8fr_auto]">
                <Input
                  value={item.name}
                  onChange={(event) =>
                    setList((prev) =>
                      prev.map((row) =>
                        row.id === item.id ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  value={item.color}
                  onChange={(event) =>
                    setList((prev) =>
                      prev.map((row) =>
                        row.id === item.id ? { ...row, color: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  value={String(item.sortOrder)}
                  onChange={(event) =>
                    setList((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, sortOrder: Number(event.target.value) || 0 }
                          : row,
                      ),
                    )
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">条目 {item.entryCount}</span>
                  <Button size="sm" onClick={() => void updateTag(item)}>
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void removeTag(item.id)}>
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
