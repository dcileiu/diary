import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 缩短客户端 Router Cache 保留时间（与 admin 段 force-dynamic 配合） */
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },

  /**
   * 与 middleware 双保险：页面与 API 响应头禁止缓存。
   * 不含 _next/static、_next/image，避免拖慢带 hash 的 JS/CSS。
   */
  async headers() {
    const noStoreHtml = [
      {
        key: "Cache-Control",
        value:
          "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ] as const;
    return [
      {
        source: "/",
        headers: [...noStoreHtml],
      },
      {
        source: "/api/admin/:path*",
        headers: [...noStoreHtml],
      },
      {
        source: "/api/v1/:path*",
        headers: [...noStoreHtml],
      },
      {
        source: "/admin/:path*",
        headers: [...noStoreHtml],
      },
      {
        source: "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
        headers: [...noStoreHtml],
      },
    ];
  },
};

export default nextConfig;
