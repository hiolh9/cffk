/**
 * Event-level idempotency for payment webhooks / async notifies.
 * First successful claim processes the event; duplicates return false (already seen).
 */

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export type WebhookEventClaimInput = {
  provider: string;
  orderNo?: string | null;
  paymentOrderNo?: string | null;
  status: string;
  amount?: number | null;
  eventId?: string | null;
  deliveryId?: string | null;
  headers?: Headers | null;
};

export async function buildPaymentWebhookEventKey(input: WebhookEventClaimInput): Promise<string> {
  const provider = input.provider.toUpperCase();
  const eventId =
    input.eventId?.trim() ||
    input.headers?.get("X-PerPay-Webhook-Event-Id")?.trim() ||
    input.headers?.get("stripe-event-id")?.trim() ||
    "";
  const deliveryId =
    input.deliveryId?.trim() ||
    input.headers?.get("X-PerPay-Webhook-Delivery-Id")?.trim() ||
    "";

  if (eventId) return `${provider}:event:${eventId}`;
  if (deliveryId) return `${provider}:delivery:${deliveryId}`;

  const raw = [
    provider,
    input.orderNo ?? "",
    input.paymentOrderNo ?? "",
    input.status,
    input.amount == null ? "" : String(input.amount),
  ].join("|");
  return `${provider}:hash:${await sha256(raw)}`;
}

/**
 * @returns true if first sight of event (caller should process).
 * @returns false if already recorded (caller should ack without re-processing).
 * On table-missing / DB errors, returns true so payment is not dropped.
 */
export async function claimPaymentWebhookEvent(
  database: D1Database,
  input: WebhookEventClaimInput & { orderId?: number | null },
): Promise<boolean> {
  if (input.status !== "PAID" && input.status !== "FAILED") return true;

  const eventKey = await buildPaymentWebhookEventKey(input);
  const now = Date.now();
  try {
    const result = await database
      .prepare(
        `INSERT OR IGNORE INTO paymentWebhookEvent (eventKey, provider, orderNo, orderId, paymentStatus, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        eventKey,
        input.provider.toUpperCase(),
        input.orderNo ?? null,
        input.orderId ?? null,
        input.status,
        now,
      )
      .run();
    const changes = Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0);
    return changes > 0;
  } catch (cause) {
    const msg = String(cause);
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("constraint")) {
      return false;
    }
    return true;
  }
}
