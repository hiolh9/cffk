const STORAGE_KEY = "cffk_device_id";

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable per-browser device id for basic checkout rate limiting. */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") return randomId();
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const next = randomId().slice(0, 32);
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomId().slice(0, 32);
  }
}
