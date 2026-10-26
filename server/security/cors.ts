/** Same-origin-ish checks for browser credentialed API/telefunc calls. */

export function isAllowedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  // Non-browser or same-origin navigations often omit Origin
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const h = new URL(request.url);
    if (o.protocol !== "http:" && o.protocol !== "https:") return false;
    // Exact host match (includes workers.dev / custom domain)
    if (o.host === h.host) return true;
    // Allow localhost dev against local worker
    if (o.hostname === "localhost" || o.hostname === "127.0.0.1") {
      return h.hostname === "localhost" || h.hostname === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
}

export function corsRejectResponse(): Response {
  return new Response(JSON.stringify({ code: "CORS_REJECTED", message: "Origin not allowed" }), {
    status: 403,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
