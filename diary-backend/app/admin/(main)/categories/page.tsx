"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

type Category = { id: number; name: string; sortOrder: number };

function authHeaders(): HeadersInit {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
      : null;
  const h: Record<string, string> = {};
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export default function AdminCategoriesPage() {
  const [list, setList] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editOrder, setEditOrder] = React.useState("");
  const [noticeText, setNoticeText] = React.useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = React.useState<number | null>(
    null,
  );

  const showNotice = React.useCallback((message: string) => {
    setNoticeText(message);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/admin/wallpaper-categories", {
        headers: { ...authHeaders() },
      });
      const j = (await res.json()) as {
        code?: number;
        data?: { list?: Category[] };
      };
      if (j.code === 0 && j.data?.list) setList(j.data.list);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    const res = await adminApiFetch("/api/admin/wallpaper-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ name: n }),
    });
    const j = (await res.json()) as { code?: number; message?: string };
    if (j.code === 0) {
      setNewName("");
      load();
    } else {
      showNotice(j.message ?? "添加失败");
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditOrder(String(c.sortOrder));
  }

  async function saveEdit() {
    if (editingId == null) return;
    const res = await adminApiFetch(`/api/admin/wallpaper-categories/${editingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        name: editName.trim(),
        sortOrder: Number(editOrder) || 0,
      }),
    });
    const j = (await res.json()) as { code?: number; message?: string };
    if (j.code === 0) {
      setEditingId(null);
      load();
    } else {
      showNotice(j.message ?? "保存失败");
    }
  }

  function requestRemoveCategory(id: number) {
    setDeleteCategoryId(id);
  }

  async function confirmDeleteCategory() {
    if (deleteCategoryId == null) return;
    const id = deleteCategoryId;
    setDeleteCategoryId(null);
    const res = await adminApiFetch(`/api/admin/wallpaper-categories/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    const j = (await res.json()) as { code?: number; message?: string };
    if (j.code === 0) {
      setList((prev) => prev.filter((c) => c.id !== id));
      await load();
    } else {
      showNotice(j.message ?? "删除失败");
    }
  }

  return (
    <div className="mx-auto max-w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          分类管理
        </h1>
        <p className="text-muted-foreground text-sm">
          对应壁纸的 <code className="text-xs">type</code>{" "}
          字段；内容管理里下拉选用。删除前请确保没有壁纸仍使用该类型名。
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/content" className="text-primary underline-offset-4 hover:underline">
            ← 返回内容管理
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增分类</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={add}
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="space-y-1.5 w-full sm:w-auto sm:min-w-[200px]">
              <Label>名称</Label>
              <Input
                className="min-h-11 text-base sm:min-h-9 sm:text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：动态壁纸"
              />
            </div>
            <Button
              type="submit"
              className="min-h-11 w-full touch-manipulation sm:min-h-9 sm:w-auto"
            >
              添加
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">分类列表</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 touch-manipulation sm:min-h-9"
            onClick={() => load()}
          >
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {list.map((c) => (
                  <Card key={c.id} className="shadow-none">
                    <CardContent className="space-y-3 p-4 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          排序 {c.sortOrder}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {editingId === c.id ? (
                          <>
                            <Input
                              className="min-h-11 text-base"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <Input
                              className="min-h-11 font-mono text-base"
                              inputMode="numeric"
                              value={editOrder}
                              onChange={(e) =>
                                setEditOrder(e.target.value.replace(/\D/g, ""))
                              }
                            />
                            <div className="flex gap-2">
                              <Button
                                size="default"
                                type="button"
                                className="min-h-11 flex-1 touch-manipulation"
                                onClick={saveEdit}
                              >
                                保存
                              </Button>
                              <Button
                                size="default"
                                type="button"
                                variant="outline"
                                className="min-h-11 flex-1 touch-manipulation"
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Button
                              size="default"
                              variant="outline"
                              type="button"
                              className="min-h-11 w-full touch-manipulation"
                              onClick={() => startEdit(c)}
                            >
                              编辑
                            </Button>
                            <Button
                              size="default"
                              variant="outline"
                              type="button"
                              className="min-h-11 w-full touch-manipulation text-destructive"
                              onClick={() => requestRemoveCategory(c.id)}
                            >
                              删除
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="hidden overflow-x-auto touch-pan-x sm:block">
                <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">排序</th>
                  <th className="pb-2 pr-3 font-medium">名称</th>
                  <th className="pb-2 font-medium w-48">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {editingId === c.id ? (
                        <Input
                          className="h-8 w-20 font-mono"
                          inputMode="numeric"
                          value={editOrder}
                          onChange={(e) =>
                            setEditOrder(e.target.value.replace(/\D/g, ""))
                          }
                        />
                      ) : (
                        c.sortOrder
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {editingId === c.id ? (
                        <Input
                          className="h-8 max-w-xs"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="py-2">
                      {editingId === c.id ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" type="button" onClick={saveEdit}>
                            保存
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => startEdit(c)}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            type="button"
                            onClick={() => requestRemoveCategory(c.id)}
                          >
                            删除
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        open={deleteCategoryId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteCategoryId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该分类？若有壁纸仍使用该类型名称将无法删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDeleteCategory()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
