import { enhance, type UniversalHandler } from "@universal-middleware/core";
import { telefunc, config } from "telefunc";
import { reportUnexpectedRequestError } from "./error-handling";
import { checkSecurityRateLimit } from "./security/rate-limit";

const { telefuncConfig, serve } = await (async () => {
  config.disableNamingConvention = true;
  return { telefuncConfig: config, serve: telefunc };
})();

void telefuncConfig;

export const telefuncHandler: UniversalHandler = enhance(
  async (request, context, runtime) => {
    try {
      const db = (runtime as { env?: { DB?: D1Database } }).env?.DB
        ?? (context as { env?: { DB?: D1Database } }).env?.DB;
      const clientIp = request.headers.get("CF-Connecting-IP");
      if (db) {
        const isAdmin = Boolean((context as { isAdmin?: boolean }).isAdmin);
        const check = await checkSecurityRateLimit(db, {
          action: isAdmin ? "ADMIN_TELEFUNC" : "TELEFUNC",
          clientIp,
        });
        if (!check.allowed) {
          return new Response(JSON.stringify({ error: true, code: "RATE_LIMITED" }), {
            status: 429,
            headers: { "content-type": "application/json", "Retry-After": String(check.retryAfterSec) },
          });
        }
      }
      const httpResponse = await serve({
        request,
        context: {
          ...(context as object),
          ...(runtime as { runtime: "workerd"; env?: { DB: D1Database } }),
          clientIp: request.headers.get("CF-Connecting-IP"),
        },
      });

      return new Response(httpResponse.getReadableWebStream(), {
        status: httpResponse.statusCode,
        headers: httpResponse.headers,
      });
    } catch (cause) {
      await reportUnexpectedRequestError("telefunc transport", cause, request);
      throw cause;
    }
  },
  {
    name: "my-app:telefunc-handler",
    path: `/_telefunc`,
    method: ["GET", "POST"],
    immutable: false,
  },
);
