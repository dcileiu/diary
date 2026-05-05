export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

function applyCors(response: Response) {
  response.headers.set(
    "Access-Control-Allow-Origin",
    process.env.OPEN_MEDIA_EXTRACT_ALLOW_ORIGIN?.trim() || "*",
  );
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-api-key, range",
  );
  response.headers.set("Vary", "Origin");
  return response;
}

function parseIpv4(hostname: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function isPrivateIpv4(hostname: string) {
  const parts = parseIpv4(hostname);
  if (!parts) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedHostname(hostname: string) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("fe80:")) return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  return isPrivateIpv4(host);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Proxy failed";
}

function pickForwardHeaders(req: Request, referer: string) {
  const headers = new Headers();
  headers.set("user-agent", DESKTOP_USER_AGENT);
  headers.set("accept", req.headers.get("accept") || "*/*");
  const range = req.headers.get("range");
  if (range) headers.set("range", range);
  if (referer) headers.set("referer", referer);
  return headers;
}

function copyHeaderIfPresent(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

export function OPTIONS() {
  return applyCors(new Response(null, { status: 204 }));
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const rawUrl = requestUrl.searchParams.get("url") || "";
    const referer = requestUrl.searchParams.get("referer") || "";

    if (!rawUrl.trim()) {
      return applyCors(new Response("Missing parameter: url", { status: 400 }));
    }

    const target = new URL(rawUrl);
    if (target.protocol !== "https:") {
      return applyCors(new Response("Only https URLs are allowed.", { status: 400 }));
    }
    if (isBlockedHostname(target.hostname)) {
      return applyCors(new Response("Blocked target hostname.", { status: 400 }));
    }

    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: pickForwardHeaders(req, referer),
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.body) {
      return applyCors(new Response("Empty upstream response.", { status: 502 }));
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (
      !/^image\//i.test(contentType) &&
      !/^video\//i.test(contentType) &&
      !/^application\/octet-stream/i.test(contentType)
    ) {
      return applyCors(
        new Response(`Unsupported upstream content-type: ${contentType}`, {
          status: 415,
        }),
      );
    }

    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set("content-disposition", "inline");
    copyHeaderIfPresent(upstream.headers, headers, "content-length");
    copyHeaderIfPresent(upstream.headers, headers, "content-range");
    copyHeaderIfPresent(upstream.headers, headers, "accept-ranges");
    copyHeaderIfPresent(upstream.headers, headers, "cache-control");
    copyHeaderIfPresent(upstream.headers, headers, "etag");
    copyHeaderIfPresent(upstream.headers, headers, "last-modified");

    return applyCors(
      new Response(upstream.body, {
        status: upstream.status,
        headers,
      }),
    );
  } catch (error) {
    return applyCors(
      new Response(`Media proxy failed: ${safeErrorMessage(error)}`, {
        status: 500,
      }),
    );
  }
}
