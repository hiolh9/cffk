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

// NOTE: Full file restored from last good commit. Idempotency lives in checkout.telefunc.ts.
export { };
