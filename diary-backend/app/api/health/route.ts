import { NextResponse } from "next/server";

import { isAdminAuthConfigured } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  isProductionRuntime,
  missingCriticalConfigKeys,
  missingDatabaseConfig,
} from "@/lib/runtime-config";

export async function GET() {
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

  return NextResponse.json(
    {
      ok,
      service: "grudge-diary-backend",
      environment: process.env.NODE_ENV || "development",
      checks: {
        ...checks,
        databaseReachable,
      },
      missingConfig,
    },
    { status: ok || !isProductionRuntime() ? 200 : 503 },
  );
}
