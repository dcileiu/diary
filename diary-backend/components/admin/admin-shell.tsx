"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookHeart,
  LayoutDashboard,
  LogOut,
  Settings2,
  Tags,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { adminApiFetch } from "@/lib/admin-client-fetch";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, match: /^\/admin\/?$/ },
  {
    href: "/admin/entries",
    label: "条目管理",
    icon: BookHeart,
    match: /^\/admin\/entries/,
  },
  {
    href: "/admin/categories",
    label: "分类管理",
    icon: Tags,
    match: /^\/admin\/categories/,
  },
  {
    href: "/admin/tags",
    label: "标签管理",
    icon: Tags,
    match: /^\/admin\/tags/,
  },
  { href: "/admin/users", label: "用户", icon: Users, match: /^\/admin\/users/ },
  {
    href: "/admin/settings",
    label: "系统信息",
    icon: Settings2,
    match: /^\/admin\/settings/,
  },
];

function adminBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "admin") return [{ label: "后台", href: "/admin" }];
  const crumbs: { label: string; href: string }[] = [
    { label: "后台", href: "/admin" },
  ];
  const labels: Record<string, string> = {
    entries: "条目管理",
    categories: "分类管理",
    tags: "标签管理",
    users: "用户",
    settings: "系统信息",
  };
  let acc = "/admin";
  for (const seg of segments.slice(1)) {
    acc += `/${seg}`;
    crumbs.push({ label: labels[seg] ?? seg, href: acc });
  }
  return crumbs;
}

function MobileSidebarAutoClose({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  return null;
}

async function adminLogout(router: ReturnType<typeof useRouter>) {
  const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  // 先请求服务端吊销会话（best-effort），再清本地令牌并跳转登录页。
  if (token) {
    try {
      await adminApiFetch("/api/admin/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // 网络异常也要继续本地登出，避免卡在后台。
    }
  }
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  router.push("/admin/login");
  router.refresh();
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const crumbs = adminBreadcrumbs(pathname);
  const currentLabel = crumbs.at(-1)?.label ?? "后台";

  return (
    <>
      <MobileSidebarAutoClose pathname={pathname} />
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-3.5 p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-sm">
              仇
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">记仇日记后台</span>
              <span className="truncate text-xs text-muted-foreground">
                小程序与后台共用一套数据模型
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>菜单</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={item.match.test(pathname)}
                      tooltip={item.label}
                      size="lg"
                      className="!min-h-16 !h-16 !gap-3 !px-3 !text-[15px] [&_svg]:!size-5"
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-0">
          <SidebarMenu className="gap-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="退出登录"
                size="lg"
                className="!min-h-16 !h-16 !gap-3 !px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => adminLogout(router)}
              >
                <LogOut className="size-5 shrink-0" />
                <span className="text-[15px] group-data-[collapsible=icon]:hidden">
                  退出登录
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="返回站点首页"
                size="lg"
                className="!min-h-16 !h-16 !gap-3 !px-3"
                render={<Link href="/" />}
              >
                <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  → 返回站点首页
                </span>
                <span className="hidden group-data-[collapsible=icon]:block text-xs">
                  →
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4",
            "pt-[max(0.25rem,env(safe-area-inset-top))] sm:pt-0 min-h-14",
          )}
        >
          <SidebarTrigger
            className={cn(
              "-ml-1 size-11 min-h-11 min-w-11 shrink-0 md:size-9 md:min-h-9 md:min-w-9",
              "touch-manipulation",
            )}
          />
          <Separator orientation="vertical" className="mr-1 h-6 sm:mr-2" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-wrap items-center gap-x-1">
              <BreadcrumbItem className="min-w-0 sm:hidden">
                <BreadcrumbPage className="truncate font-medium">
                  {currentLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
              {crumbs.map((item, index) => (
                <React.Fragment key={item.href}>
                  {index > 0 ? (
                    <BreadcrumbSeparator className="hidden sm:inline" />
                  ) : null}
                  <BreadcrumbItem className="hidden min-w-0 sm:inline-block">
                    {index === crumbs.length - 1 ? (
                      <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={item.href} />}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "outline-none touch-manipulation rounded-full p-1",
                "min-h-11 min-w-11 flex items-center justify-center md:min-h-0 md:min-w-0 md:p-0",
              )}
            >
              <Avatar className="size-8">
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>管理员</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
                系统信息
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => adminLogout(router)}>
                退出登录
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/")}>
                站点首页
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main
          className={cn(
            "flex-1 overflow-auto p-3 sm:p-4 md:p-6",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </SidebarProvider>
  );
}
