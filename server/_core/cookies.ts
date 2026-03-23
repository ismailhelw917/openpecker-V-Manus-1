import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);
  // With trust proxy = 1, req.get('host') returns x-forwarded-host when available.
  // Also check x-forwarded-host directly as a fallback.
  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.get('host') || '';
  // Strip port from host (e.g. "openpecker.com:443" -> "openpecker.com")
  const host = rawHost.split(':')[0];
  
  let domain: string | undefined = undefined;
  if (host.includes('openpecker.com')) {
    domain = 'openpecker.com';
  } else if (host.includes('manus.space')) {
    domain = host;
  }
  
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecure,
  };
}
