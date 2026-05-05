import type { ReactNode } from "react";
import { unstable_noStore } from "next/cache";
import { connection } from "next/server";

/** 管理后台：禁用 Full Route Cache / 预渲染壳，避免 X-Nextjs-Cache: HIT、s-maxage 一年 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  unstable_noStore();
  await connection();
  return <div className="min-h-svh w-full">{children}</div>;
}
