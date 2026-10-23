import { getOrCreateDeviceId } from "@/lib/device-id";

export type DeviceFingerprintPayload = {
  /** Soft id from localStorage (required by checkout). */
  deviceId: string;
  /** SHA-256 hex of browser signals (canvas/webgl/screen/…). */
  fpHash: string;
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function canvasSignal(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 120, 60);
    ctx.fillStyle = "#069";
    ctx.fillText("CFFK-fp-v1", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("CFFK-fp-v1", 4, 17);
    return c.toDataURL().slice(-96);
  } catch {
    return "";
  }
}

function webglSignal(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "") : "";
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "") : "";
    return `${vendor}|${renderer}`;
  } catch {
    return "";
  }
}

/**
 * Collect a stable-ish hardware/browser fingerprint.
 * Not immune to advanced spoofing, but survives localStorage clears better than soft deviceId alone.
 */
export async function collectDeviceFingerprint(): Promise<DeviceFingerprintPayload> {
  const deviceId = getOrCreateDeviceId();
  if (typeof window === "undefined") {
    return { deviceId, fpHash: deviceId };
  }

  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  const parts: Record<string, string> = {
    canvas: canvasSignal(),
    webgl: webglSignal(),
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}x${devicePixelRatio || 1}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    lang: navigator.languages?.join(",") || navigator.language || "",
    platform: nav.userAgentData?.platform || navigator.platform || "",
    hw: String(navigator.hardwareConcurrency || 0),
    mem: String(nav.deviceMemory || 0),
    touch: String(navigator.maxTouchPoints || 0),
    maxTouch: String(navigator.maxTouchPoints || 0),
    cookie: String(navigator.cookieEnabled),
  };

  const raw = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");
  const fpHash = (await sha256Hex(`cffk-fp:v1:${raw}`)).slice(0, 64);
  return { deviceId, fpHash };
}
