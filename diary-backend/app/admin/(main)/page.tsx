"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

type Stats = {
  wallpaperCount: number;
  userCount: number;
  collectionCount: number;
  downloadCount: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (!t) return;
    adminApiFetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((j: { code?: number; data?: Stats; message?: string }) => {
        if (j.code !== 0 || !j.data) {
          setErr(j.message ?? "加载失败");
          return;
        }
        setStats(j.data);
      })
      .catch(() => setErr("网络错误"));
  }, []);

  return (
    <div className="mx-auto max-w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          概览
        </h1>
        <p className="text-muted-foreground text-sm">
          数据来自内存仓库，与小程序共用同一套 WallpaperStore。
        </p>
      </div>
      {err ? (
        <p className="text-destructive text-sm">{err}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "壁纸数",
            value: stats ? String(stats.wallpaperCount) : "—",
            hint: "/admin/content · GET /api/admin/wallpapers",
          },
          {
            title: "用户数",
            value: stats ? String(stats.userCount) : "—",
            hint: "/admin/users · GET /api/admin/users",
          },
          {
            title: "收藏条数",
            value: stats ? String(stats.collectionCount) : "—",
            hint: "内存中的收藏记录总数",
          },
          {
            title: "下载条数",
            value: stats ? String(stats.downloadCount) : "—",
            hint: "用户下载记录总数",
          },
          {
            title: "管理 API",
            value: "已启用",
            hint: "POST /api/admin/login",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {item.title}
              </CardTitle>
              <Badge variant="secondary" className="font-normal">
                实时
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p title={item.hint} className="text-muted-foreground text-xs truncate">
                {item.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
