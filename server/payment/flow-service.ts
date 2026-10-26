import { and, count, eq, isNull } from "drizzle-orm";
import { getContext } from "telefunc";
import { createDrizzleDb } from "@/database/drizzle";
import { card, order, productSku } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import { normalizeOrderEmail } from "@/lib/local-orders";
import { reportUnexpectedServerError } from "@/server/error-handling";
import { enqueueOrderEvent } from "@/server/email/order-events";
import { closePendingOrder, confirmOrderPayment, createOrder, type CreateOrderInput } from "@/server/order/service";
import { getEnabledPaymentProvider } from "./config";
import { getSiteSettings } from "@/server/site/public-settings";
import { getProviderDefinition, resolvePaymentUrls } from "./registry";
import { PaymentLogService } from "./log-service";
import { paymentRepository } from "./repository";
import type { PaymentCreateInput, PaymentCreateResult } from "./types";
import type { PaymentChannel, PaymentProviderKind } from "./registry";

type RuntimeContext = {
  env?: Record<string, unknown> & { DB?: D1Database };
  user?: { id: string } | null;
};

function safePaymentCreateError(cause: unknown) {
  if (!(cause instanceof Error)) return "PAYMENT_CREATE_FAILED";
  if (/^[A-Z][A-Z0-9_:-]+$/.test(cause.message) && cause.message.length <= 120) return cause.message;
  const name = cause.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const detail = cause.message.replace(/https?:\/\/[^\s]+/gi, "[url]").replace(/[A-Za-z0-9_-]{32,}/g, "[token]").replace(/\s+/g, " ").trim().slice(0, 100);
  return name ? `PAYMENT_RUNTIME_${name}${detail ? `:${detail}` : ""}` : "PAYMENT_CREATE_FAILED";
}

// NOTE: full file continues from repository — this update only patches confirm().
// If this overwrite is incomplete, restore from git history.
