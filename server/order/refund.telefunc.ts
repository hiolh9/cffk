import { telefuncAction } from "@/server/telefunc-action";
import { requireAdminSecure } from "@/server/telefunc-context";
import { refundAdminOrder } from "@/server/order/refund";

export const onRefundAdminOrder = telefuncAction(async (input: {
  orderId: number;
  type?: "REFUND" | "VOID";
  refundAmountMajor?: number;
  bankImpactMyr?: number;
  reason?: string;
  skipAccounting?: boolean;
}) => {
  const { database, adminUserId } = await requireAdminSecure();
  return refundAdminOrder(database, { ...input, adminUserId });
});
