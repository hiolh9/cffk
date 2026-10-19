import { appError } from "@/lib/app-error";

/**
 * Prevent SSRF when calling upstream top-up APIs:
 * - Only http/https
 * - Require https for public hosts
 * - Block localhost, private, link-local, metadata IPs
 */
export function assertSafeSupplierBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    appError("SUPPLIER_URL_INVALID");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    appError("SUPPLIER_URL_INVALID");
  }

  const host = url.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
    appError("SUPPLIER_URL_PRIVATE");
  }

  if (host === "metadata.google.internal" || host === "metadata" || host.endsWith(".internal")) {
    appError("SUPPLIER_URL_PRIVATE");
  }

  if (isPrivateOrReservedHost(host)) {
    appError("SUPPLIER_URL_PRIVATE");
  }

  if (url.protocol === "http:") {
    appError("SUPPLIER_URL_HTTPS_REQUIRED");
  }

  if (url.username || url.password) {
    appError("SUPPLIER_URL_INVALID");
  }

  return url.origin;
}

function isPrivateOrReservedHost(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const octets = m.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return true;
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (host.includes(":")) {
    const h = host.replace(/^\[|\]$/g, "");
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
    if (h.startsWith("::ffff:")) {
      return isPrivateOrReservedHost(h.slice(7));
    }
  }

  return false;
}
