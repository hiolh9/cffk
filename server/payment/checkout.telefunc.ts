import { telefuncAction } from "@/server/telefunc-action";
import { requireUser } from "@/server/telefunc-context";
import { enforceSecurityRateLimit } from "@/server/security/rate-limit";
import { getOpsKillSwitches } from "@/server/ops/kill-switch";
import { assertCheckoutAccount } from "@/server/ops/risk-limits";
import { appError } from "@/lib/app-error";
import { requirePaymentFlowService } from "./flow-service";
import type { PaymentCreateInput } from "./types";

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !DEVICE_ID_RE.test(trimmed)) return null;
  return trimmed;
}

async function internalOnCreatePayment(input: PaymentCreateInput) {
  const { user, database, context } = requireUser();

  const switches = await getOpsKillSwitches(database);
  if (!switches.checkoutEnabled) {
    appError("CHECKOUT_DISABLED");
  }

  await assertCheckoutAccount(database, user.id);

  // Device id is required so ORDER_CREATE_DEVICE rate limits cannot be skipped.
  const deviceId = normalizeDeviceId(input.deviceId);
  if (!deviceId) {
    appError("DEVICE_ID_REQUIRED");
  }

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

  const { deviceId: _ignored, ...orderInput } = input;
  return requirePaymentFlowService().create(orderInput, user.id);
}

export const onCreatePayment = telefuncAction(internalOnCreatePayment);

export type { PaymentCreateInput };
