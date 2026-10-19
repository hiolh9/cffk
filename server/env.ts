import { env as cloudflareEnv } from "cloudflare:workers";

type AppEnv = typeof cloudflareEnv & {
  ADMIN_PATH?: string;
  /** Comma-separated admin IP allowlist (exact IPs). Empty = allow all. */
  ADMIN_IP_ALLOWLIST?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export const env = cloudflareEnv as AppEnv;
