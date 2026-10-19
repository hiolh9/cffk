import { env } from "@/server/env";
import { appError } from "@/lib/app-error";

type EnvWithAllowlist = typeof env & { ADMIN_IP_ALLOWLIST?: string };

/**
 * Optional admin IP allowlist.
 * Set Worker env ADMIN_IP_ALLOWLIST to a comma-separated list of exact IPs.
 * When empty/unset, all IPs are allowed (default).
 */
export function getAdminIpAllowlist(): string[] {
  const raw = (env as EnvWithAllowlist).ADMIN_IP_ALLOWLIST?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isClientIpAllowed(clientIp: string | null | undefined, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const ip = clientIp?.trim() || "";
  if (!ip) return false;
  return allowlist.includes(ip);
}

/** Throws ADMIN_IP_DENIED when allowlist is configured and IP is not listed. */
export function assertAdminIpAllowed(clientIp: string | null | undefined) {
  const allowlist = getAdminIpAllowlist();
  if (!isClientIpAllowed(clientIp, allowlist)) {
    appError("ADMIN_IP_DENIED");
  }
}
