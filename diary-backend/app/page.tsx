import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">记仇日记全栈系统</h1>
        <p className="text-muted-foreground max-w-xl text-sm">
          现在这个项目已经围绕微信小程序记仇日记重组：前端是小程序，后端是
          Next.js + Prisma，后台管理用于查看用户、条目、分类和标签。
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
          查看健康检查
        </Link>
      </div>
    </div>
  );
}
