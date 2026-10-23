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

  const { deviceId: _d, deviceFp: _f, ...orderInput } = input;
  return requirePaymentFlowService().create(orderInput, user.id);
}

export const onCreatePayment = telefuncAction(internalOnCreatePayment);

export type { PaymentCreateInput };
