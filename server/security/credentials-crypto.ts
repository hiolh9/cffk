import { env } from "@/server/env";

const PREFIX = "enc:v1:";

type EnvWithSecret = typeof env & { BETTER_AUTH_SECRET?: string };

function getSecretMaterial(): string {
  const secret = (env as EnvWithSecret).BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("BETTER_AUTH_SECRET_REQUIRED_FOR_CREDENTIALS");
  }
  return secret;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("cffk-supplier-credentials-v1"),
      info: new TextEncoder().encode("credentials-json"),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sealCredentials(credentials: object): Promise<string> {
  const key = await deriveAesKey(getSecretMaterial());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(credentials));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const packed = new Uint8Array(iv.length + sealed.length);
  packed.set(iv, 0);
  packed.set(sealed, iv.length);
  return PREFIX + toB64(packed);
}

export async function openCredentials(stored: string): Promise<Record<string, unknown>> {
  const raw = stored?.trim() ?? "";
  if (!raw) return {};

  if (!raw.startsWith(PREFIX)) {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("CREDENTIALS_INVALID");
    }
    return parsed as Record<string, unknown>;
  }

  const key = await deriveAesKey(getSecretMaterial());
  const packed = fromB64(raw.slice(PREFIX.length));
  if (packed.length < 13) throw new Error("CREDENTIALS_INVALID");
  const iv = packed.slice(0, 12);
  const data = packed.slice(12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data));
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CREDENTIALS_INVALID");
  }
  return parsed as Record<string, unknown>;
}

export function isEncryptedCredentials(stored: string): boolean {
  return stored.trim().startsWith(PREFIX);
}

export function credentialsConfigured(stored: string | null | undefined): boolean {
  if (!stored?.trim()) return false;
  if (isEncryptedCredentials(stored)) return true;
  try {
    return Object.keys(JSON.parse(stored) as object).length > 0;
  } catch {
    return false;
  }
}
