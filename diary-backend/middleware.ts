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
  for (const [key, value] of Object.entries(noStoreHeaders)) {
    res.headers.set(key, value);
  }
  return res;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/v1")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: { ...corsHeaders, ...noStoreHeaders },
      });
    }

    const res = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.headers.set(key, value);
    }
    return applyNoStore(res);
  }

  return applyNoStore(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
  ],
};
