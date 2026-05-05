import type { ReactNode } from "react";
import { unstable_noStore } from "next/cache";
import { connection } from "next/server";

/**
 * content 为 client page，段配置不能写在 page.tsx 内；
 * 单独 Server Layout 确保本路由不参与 build 时静态壳缓存（避免 X-Nextjs-Cache: HIT）。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminContentLayout({
  children,
}: {
  children: ReactNode;
}) {
  unstable_noStore();
  await connection();
  return children;
}
