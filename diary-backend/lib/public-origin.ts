function isLocalHost(host: string): boolean {
  const value = host.split(":")[0]?.toLowerCase() ?? "";
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

function isPrivateOrLocalHost(host: string): boolean {
  if (isLocalHost(host)) return true;

  const value = host.split(":")[0] ?? "";
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/i.test(value)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(value)) return true;

  const matched = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/i.exec(value);
  if (!matched) return false;

  const second = Number(matched[1]);
  return second >= 16 && second <= 31;
}

export function requestPublicOrigin(req: Request): string {
  const fromEnv = process.env.PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) {
    try {
      const raw = /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
      const origin = new URL(raw);
      const protocol =
        origin.protocol === "http:" && !isPrivateOrLocalHost(origin.host)
          ? "https:"
          : origin.protocol;
      return `${protocol}//${origin.host}`;
    } catch {
      // fall through
    }
  }

  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? url.host;
  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  let protocol: string;
  if (forwardedProto === "https" || forwardedProto === "http") {
    protocol = forwardedProto;
  } else {
    protocol = isPrivateOrLocalHost(host)
      ? url.protocol.replace(":", "") || "http"
      : "https";
  }

  if (protocol === "http" && !isPrivateOrLocalHost(host)) {
    protocol = "https";
  }

  return `${protocol}://${host}`;
}

export function requestPublicAssetOrigin(req: Request): string {
  const fromEnv = process.env.PUBLIC_ASSET_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) {
    try {
      const raw = /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
      const origin = new URL(raw);
      return `${origin.protocol}//${origin.host}`;
    } catch {
      // fall through
    }
  }

  return requestPublicOrigin(req);
}

export function absolutePublicUrl(req: Request, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${requestPublicOrigin(req)}${path}`;
}

export function absoluteAssetUrl(req: Request, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${requestPublicAssetOrigin(req)}${path}`;
}

export function upgradeSameHostAvatarHttpToHttps(
  avatar: string,
  siteOrigin: string,
): string | null {
  const raw = siteOrigin.trim().replace(/\/$/, "");
  if (!raw) return null;

  let site: URL;
  try {
    site = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const avatarValue = avatar.trim();
  if (!/^https?:\/\//i.test(avatarValue)) return null;

  let avatarUrl: URL;
  try {
    avatarUrl = new URL(avatarValue);
  } catch {
    return null;
  }

  if (avatarUrl.protocol !== "http:") return null;
  if (avatarUrl.hostname.toLowerCase() !== site.hostname.toLowerCase()) return null;

  return `https://${avatarUrl.host}${avatarUrl.pathname}${avatarUrl.search}${avatarUrl.hash}`;
}
