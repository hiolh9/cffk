import { and, eq, gt } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { paymentLog } from "@/database/drizzle/schema";
import { reportUnexpectedServerError } from "@/server/error-handling";
import { redactSensitive } from "@/server/security/log-redact";
import type { PaymentProviderKind } from "./registry";

export function sanitizePaymentLogPayload(value: unknown): unknown {
  return redactSensitive(value);
}

export class PaymentLogService {
  constructor(private readonly database: D1Database) {}

  async write(input: {
    orderId?: number;
    provider: PaymentProviderKind;
    orderNo?: string;
    paymentOrderNo?: string;
    eventType: string;
    verifyStatus: "PENDING" | "VERIFIED" | "FAILED";
    message?: string;
    payload?: unknown;
  }) {
    await createDrizzleDb(this.database).insert(paymentLog).values({
      orderId: input.orderId ?? null,
      provider: input.provider,
      orderNo: input.orderNo ?? null,
      paymentOrderNo: input.paymentOrderNo ?? null,
      eventType: input.eventType,
      rawPayload: JSON.stringify(sanitizePaymentLogPayload(input.payload ?? {})),
      verifyStatus: input.verifyStatus,
      message: input.message ?? null,
      createdAt: new Date(),
    });
  }

  async writeBestEffort(
    input: {
      orderId?: number;
      provider: PaymentProviderKind;
      orderNo?: string;
      paymentOrderNo?: string;
      eventType: string;
      verifyStatus: "PENDING" | "VERIFIED" | "FAILED";
      message?: string;
      payload?: unknown;
    },
  ) {
    try {
      await this.write(input);
    } catch (cause) {
      reportUnexpectedServerError("payment-log", cause, {
        provider: input.provider,
        eventType: input.eventType,
      });
    }
  }

  async hasRecent(
    orderId: number,
    eventType: string,
    verifyStatus: "PENDING" | "VERIFIED" | "FAILED",
    since: Date,
  ) {
    const [record] = await createDrizzleDb(this.database)
      .select({ id: paymentLog.id })
      .from(paymentLog)
      .where(
        and(
          eq(paymentLog.orderId, orderId),
          eq(paymentLog.eventType, eventType),
          eq(paymentLog.verifyStatus, verifyStatus),
          gt(paymentLog.createdAt, since),
        ),
      )
      .limit(1);
    return Boolean(record);
  }
}
