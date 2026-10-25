import { telefuncAction } from "@/server/telefunc-action";
import { requireUser } from "@/server/telefunc-context";
import { enforceSecurityRateLimit } from "@/server/security/rate-limit";
import { enforceIpMultiAccountLimit } from "@/server/security/ip-multi-account";
import { enforceDeviceMultiUserLimit } from "@/server/security/device-multi-user";
import { enforceRiskBlacklist } from "@/server/security/blacklist";
import { recordDeviceSighting } from "@/server/security/device-sighting";
import { enforceBehaviorScore } from "@/server/ops/behavior-score";
import { getOpsKillSwitches } from "@/server/ops/kill-switch";
import { assertCheckoutAccount } from "@/server/ops/risk-limits";
import { appError } from "@/lib/app-error";
import { requirePaymentFlowService } from "./flow-service";
import type { PaymentCreateInput } from "./types";
import { claimOrderIdempotency, completeOrderIdempotency, normalizeOrderIdempotencyKey } from "./order-idempotency";
import { paymentRepository } from "./repository";

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const FP_HASH_RE = /^[a-f0-9]{16,64}$/i;

function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !DEVICE_ID_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizeFpHash(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !FP_HASH_RE.test(trimmed)) return null;
  return trimmed;
}

async function internalOnCreatePayment(input: PaymentCreateInput) {
  const { user, database, context } = requireUser();

  const switches = await getOpsKillSwitches(database);
  if (!switches.checkoutEnabled) {
    appError("CHECKOUT_DISABLED");
  }

  await assertCheckoutAccount(database, user.id);

  const deviceId = normalizeDeviceId(input.deviceId);
  if (!deviceId) {
    appError("DEVICE_ID_REQUIRED");
  }
  const fpHash = normalizeFpHash(input.deviceFp);

  await enforceRiskBlacklist(database, {
    clientIp: context.clientIp,
    userId: user.id,
    deviceId,
    fpHash,
  });

  await recordDeviceSighting(database, {
    userId: user.id,
    deviceId,
    clientIp: context.clientIp,
    fpHash,
  });

  await enforceDeviceMultiUserLimit(database, { deviceId, userId: user.id });
  await enforceBehaviorScore(database, {
    userId: user.id,
    deviceId,
    clientIp: context.clientIp,
    fpHash,
  });

  await enforceSecurityRateLimit(database, {
    action: "ORDER_CREATE_IP",
    clientIp: context.clientIp,
  });
  await enforceSecurityRateLimit(database, {
    action: "ORDER_CREATE_USER",
    clientIp: context.clientIp,
    extra: user.id,
  });
  await enforceSecurityRateLimit(database, {
    action: "ORDER_CREATE_DEVICE",
    clientIp: context.clientIp,
    extra: deviceId,
  });
  if (fpHash) {
    await enforceSecurityRateLimit(database, {
      action: "ORDER_CREATE_DEVICE",
      clientIp: context.clientIp,
      extra: `fp:${fpHash}`,
    });
  }
  await enforceIpMultiAccountLimit(database, {
    clientIp: context.clientIp,
    userId: user.id,
  });

  // deviceId / deviceFp are risk-only fields; flow service ignores them for createOrder.
  const rawKey = normalizeOrderIdempotencyKey(input.idempotencyKey);
  if (!rawKey) appError("IDEMPOTENCY_KEY_REQUIRED");
  const claim = await claimOrderIdempotency(database, { userId: user.id, key: rawKey });
  if (claim && "orderNo" in claim) {
    const existing = await paymentRepository(database).findOrder(claim.orderNo);
    if (existing && existing.ownerUserId === user.id) {
      if (existing.paymentStatus === "PAID") {
        return { orderNo: existing.orderNo, amount: existing.amount, paymentStatus: "PAID" as const, payment: null };
      }
      return requirePaymentFlowService().resume(claim.orderNo, user.id);
    }
  }
  const result = await requirePaymentFlowService().create(input, user.id);
  if (claim && "isNew" in claim && "keyHash" in claim) {
    const created = await paymentRepository(database).findOrder(result.orderNo);
    if (created) {
      await completeOrderIdempotency(database, { keyHash: claim.keyHash, orderNo: result.orderNo, orderId: created.id });
    }
  }
  return result;
}

export const onCreatePayment = telefuncAction(internalOnCreatePayment);

export type { PaymentCreateInput };
