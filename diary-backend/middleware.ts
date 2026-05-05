import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const noStoreHeaders = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function applyNoStore(res: NextResponse) {
  for (const [k, v] of Object.entries(noStoreHeaders)) {
    res.headers.set(k, v);
  }
  return res;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  /** 壁纸缩略图可长期缓存，不走全站 no-store */
  if (pathname === "/api/public/wallpaper-thumb") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/v1")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: { ...corsHeaders, ...noStoreHeaders },
      });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.headers.set(k, v);
    }
    return applyNoStore(res);
  }

  return applyNoStore(NextResponse.next());
}

/**
 * 除 Next 静态资源、上传目录外一律加 no-store（页面 + 各类 API），
 * 避免浏览器/中间代理缓存旧 HTML 或 RSC payload。
 */
export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
  ],
};
