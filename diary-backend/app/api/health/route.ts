import { NextResponse } from "next/server";

import { isAdminAuthConfigured } from "@/lib/admin-auth";
import { isAuthorizedAdminRequest } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import {
  isProductionRuntime,
  missingCriticalConfigKeys,
  missingDatabaseConfig,
} from "@/lib/runtime-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const missingConfig = missingCriticalConfigKeys();
  const checks = {
    databaseConfigured: !missingDatabaseConfig(),
    adminAuthConfigured: isAdminAuthConfigured(),
    wechatConfigured:
      !missingConfig.includes("WECHAT_MINI_PROGRAM_APP_ID") &&
      !missingConfig.includes("WECHAT_MINI_PROGRAM_SECRET"),
  };
  let databaseReachable = false;

  if (checks.databaseConfigured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const ok =
    missingConfig.length === 0 &&
    checks.databaseConfigured &&
    databaseReachable &&
    checks.adminAuthConfigured &&
    checks.wechatConfigured;

  const status = ok || !isProductionRuntime() ? 200 : 503;

  // 匿名探活（负载均衡 / 监控）只返回 ok + 基础信息，避免向公网暴露具体缺失了哪些配置。
  // 仅在携带合法管理员令牌时返回完整诊断明细。
  if (!(await isAuthorizedAdminRequest(req))) {
    return NextResponse.json(
      { ok, service: "grudge-diary-backend" },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok,
      service: "grudge-diary-backend",
      environment: process.env.NODE_ENV || "development",
      checks: { ...checks, databaseReachable },
      missingConfig,
    },
    { status },
  );
}
