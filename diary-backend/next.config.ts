import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  async headers() {
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value:
          "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ] as const;

    return [
      { source: "/", headers: [...noStoreHeaders] },
      { source: "/api/admin/:path*", headers: [...noStoreHeaders] },
      { source: "/api/v1/:path*", headers: [...noStoreHeaders] },
      { source: "/admin/:path*", headers: [...noStoreHeaders] },
      {
        source: "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
        headers: [...noStoreHeaders],
      },
    ];
  },
};

export default nextConfig;
