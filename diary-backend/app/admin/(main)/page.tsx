"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { adminApiFetch } from "@/lib/admin-client-fetch";

type Stats = {
  userCount: number;
  entryCount: number;
  openEntryCount: number;
  resolvedEntryCount: number;
  followUpCount: number;
  categoryCount: number;
  tagCount: number;
  todayEntryCount: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (!token) return;
    adminApiFetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json: { code?: number; data?: Stats; message?: string }) => {
        if (json.code !== 0 || !json.data) {
          setError(json.message ?? "加载统计失败");
          return;
        }
        setStats(json.data);
      })
      .catch(() => setError("网络错误"));
  }, []);

  const cards = [
    { title: "总用户数", value: stats?.userCount ?? "-", hint: "小程序已登录用户" },
    { title: "总条目数", value: stats?.entryCount ?? "-", hint: "累计记仇条目" },
    { title: "未放下条目", value: stats?.openEntryCount ?? "-", hint: "OPEN + COOLING" },
    { title: "已解决条目", value: stats?.resolvedEntryCount ?? "-", hint: "RECONCILED + RELEASED + ARCHIVED" },
    { title: "今日新增", value: stats?.todayEntryCount ?? "-", hint: "按创建时间统计" },
    { title: "跟进记录", value: stats?.followUpCount ?? "-", hint: "复盘、结果、补充总数" },
    { title: "分类数", value: stats?.categoryCount ?? "-", hint: "后台可维护的分类" },
    { title: "标签数", value: stats?.tagCount ?? "-", hint: "后台可维护的标签" },
  ];

  return (
    <div className="mx-auto max-w-full space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">概览</h1>
        <p className="text-muted-foreground text-sm">
          这套后台已经围绕“记仇条目、分类、标签、用户统计”重组，可继续往内容审核、附件上传和搜索分析扩展。
        </p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <Badge variant="secondary" className="font-normal">
                实时
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-muted-foreground text-xs">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
