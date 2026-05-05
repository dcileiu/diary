import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">壁纸小程序 · 全栈</h1>
        <p className="text-muted-foreground text-sm max-w-md">
          Next.js App Router · shadcn/ui 管理后台 · Route Handlers 可对接小程序同名 API
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/admin" className={cn(buttonVariants())}>
          进入管理后台
        </Link>
        <Link
          href="/api/health"
          className={cn(buttonVariants({ variant: "outline" }))}
          target="_blank"
          rel="noreferrer"
        >
          健康检查 JSON
        </Link>
      </div>
    </div>
  );
}
