export { auditLog, invoiceSequence, accountingArchive } from "./schema-accounting";
export * from "./schema-tables-a";
export * from "./schema-tables-b1";
export * from "./schema-tables-b2";
export { riskBlacklist, riskDeviceSighting, riskUserScore } from "./schema-risk";
export { blogPost } from "./schema-blog";
export {
  fxMonthlyRate,
  acctSale,
  acctSettlement,
  acctSettlementOrder,
  acctAdjustment,
  acctGeneralLedger,
  acctPnLSnapshot,
} from "./schema-settlement";

import {
  user, session, account, verification, twoFactor, adminBootstrap, siteSetting,
  category, productV2, productSku, discountCode, order, customerAddress,
} from "./schema-tables-a";
import {
  card, orderDelivery, paymentAttempt, automaticDeliveryJob, orderEvent, transactionGuard,
  paymentProvider, paymentLog, pushChannelConfig, orderRequestRateLimit, guestOrderRecoveryChallenge,
  emailTemplate, pushPolicy, pushLog, pushRetry, orderIdempotency, paymentWebhookEvent,
} from "./schema-tables-b1";
import {
  scheduledTaskRun, supplierAccount, supplierBinding, supplierOrder, supplierSyncSettings, s3Config, media,
} from "./schema-tables-b2";
import { auditLog, invoiceSequence, accountingArchive } from "./schema-accounting";
import { riskBlacklist, riskDeviceSighting, riskUserScore } from "./schema-risk";
import { blogPost } from "./schema-blog";
import {
  fxMonthlyRate, acctSale, acctSettlement, acctSettlementOrder, acctAdjustment,
  acctGeneralLedger, acctPnLSnapshot,
} from "./schema-settlement";

export const schema = {
  user, session, account, verification, twoFactor, adminBootstrap, siteSetting, riskBlacklist, riskDeviceSighting, riskUserScore,
  category, productV2, productSku, discountCode, order, customerAddress,
  card, orderDelivery, paymentAttempt, automaticDeliveryJob, orderEvent, transactionGuard,
  paymentProvider, paymentLog, pushChannelConfig, orderRequestRateLimit, guestOrderRecoveryChallenge,
  emailTemplate, pushPolicy, pushLog, pushRetry, orderIdempotency, paymentWebhookEvent, scheduledTaskRun,
  supplierAccount, supplierBinding, supplierOrder, supplierSyncSettings, s3Config, media,
  auditLog, invoiceSequence, accountingArchive,
  blogPost,
  fxMonthlyRate, acctSale, acctSettlement, acctSettlementOrder, acctAdjustment,
  acctGeneralLedger, acctPnLSnapshot,
};
