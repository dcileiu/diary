"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

type Row = {
  id: string;
  nickname: string;
  points: number;
  isVip: string;
  /** 与小程序「我的」统计同源：user_collection / user_download_log */
  collectSum?: number;
  downloadSum?: number;
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

export default function AdminUsersPage() {
  const [list, setList] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/admin/users", {
        headers: { ...authHeaders() },
      });
      const j = (await res.json()) as {
        code?: number;
        data?: { list?: Row[] };
      };
      if (j.code === 0 && j.data?.list) setList(j.data.list);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            用户
          </h1>
          <p className="text-muted-foreground text-sm">
            与小程序登录用户同源；列表含收藏数、下载数（与「我的」页
            <code className="text-xs">/api/v1/wallpaper/wechat/action/count</code>{" "}
            同源）。GET <code className="text-xs">/api/admin/users</code>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 touch-manipulation sm:min-h-9"
          onClick={() => load()}
        >
          刷新
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {list.map((u) => (
                  <Card key={u.id} className="shadow-none">
                    <CardContent className="space-y-2 p-4 text-sm">
                      <div className="font-medium">{u.nickname}</div>
                      <div className="text-muted-foreground text-xs font-mono break-all">
                        id {u.id}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span>发财鸭 {u.points}</span>
                        <span>VIP {u.isVip}</span>
                        <span>收藏 {u.collectSum ?? 0}</span>
                        <span>下载 {u.downloadSum ?? 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="hidden overflow-x-auto touch-pan-x sm:block">
                <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">id</th>
                  <th className="pb-2 pr-3 font-medium">昵称</th>
                  <th className="pb-2 pr-3 font-medium">发财鸭</th>
                  <th className="pb-2 pr-3 font-medium">VIP</th>
                  <th className="pb-2 pr-3 font-medium">收藏</th>
                  <th className="pb-2 pr-3 font-medium">下载</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs">{u.id}</td>
                    <td className="py-2 pr-3">{u.nickname}</td>
                    <td className="py-2 pr-3">{u.points}</td>
                    <td className="py-2 pr-3">{u.isVip}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {u.collectSum ?? 0}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {u.downloadSum ?? 0}
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
    </div>
  );
}
