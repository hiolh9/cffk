import { eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireUser } from "@/server/telefunc-context";
import { enforceSecurityRateLimit } from "@/server/security/rate-limit";
import { getOpsKillSwitches } from "@/server/ops/kill-switch";
import { user as userTable } from "@/database/drizzle/schema";
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
  const { user, database, context, db } = requireUser();

  const switches = await getOpsKillSwitches(database);
  if (!switches.checkoutEnabled) {
    appError("CHECKOUT_DISABLED");
  }

  const [account] = await db
    .select({ disabledAt: userTable.disabledAt })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);
  if (account?.disabledAt) {
    appError("ACCOUNT_DISABLED");
  }

  const deviceId = normalizeDeviceId(input.deviceId);

  await enforceSecurityRateLimit(database, {
    action: "ORDER_CREATE_IP",
    clientIp: context.clientIp,
  });
  await enforceSecurityRateLimit(database, {
    action: "ORDER_CREATE_USER",
    clientIp: context.clientIp,
    extra: user.id,
  });
  if (deviceId) {
    await enforceSecurityRateLimit(database, {
      action: "ORDER_CREATE_DEVICE",
      clientIp: context.clientIp,
      extra: deviceId,
    });
  }

  const { deviceId: _ignored, ...orderInput } = input;
  return requirePaymentFlowService().create(orderInput, user.id);
}

export const onCreatePayment = telefuncAction(internalOnCreatePayment);

export type { PaymentCreateInput };
