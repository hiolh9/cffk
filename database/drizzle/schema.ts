export { auditLog, invoiceSequence, accountingArchive } from "./schema-accounting";
export * from "./schema-tables-a";
export * from "./schema-tables-b1";
export * from "./schema-tables-b2";
export { riskBlacklist, riskDeviceSighting, riskUserScore } from "./schema-risk";

import {
  user, session, account, verification, twoFactor, adminBootstrap, siteSetting,
  category, productV2, productSku, discountCode, order, customerAddress,
} from "./schema-tables-a";
import {
  card, orderDelivery, paymentAttempt, automaticDeliveryJob, orderEvent, transactionGuard,
  paymentProvider, paymentLog, pushChannelConfig, orderRequestRateLimit, guestOrderRecoveryChallenge,
  emailTemplate, pushPolicy, pushLog, pushRetry,
} from "./schema-tables-b1";
import {
  scheduledTaskRun, supplierAccount, supplierBinding, supplierOrder, supplierSyncSettings, s3Config, media,
} from "./schema-tables-b2";
import { auditLog, invoiceSequence, accountingArchive } from "./schema-accounting";
import { riskBlacklist, riskDeviceSighting, riskUserScore } from "./schema-risk";

export const schema = {
  user, session, account, verification, twoFactor, adminBootstrap, siteSetting, riskBlacklist, riskDeviceSighting, riskUserScore,
  category, productV2, productSku, discountCode, order, customerAddress,
  card, orderDelivery, paymentAttempt, automaticDeliveryJob, orderEvent, transactionGuard,
  paymentProvider, paymentLog, pushChannelConfig, orderRequestRateLimit, guestOrderRecoveryChallenge,
  emailTemplate, pushPolicy, pushLog, pushRetry, scheduledTaskRun,
  supplierAccount, supplierBinding, supplierOrder, supplierSyncSettings, s3Config, media,
  auditLog, invoiceSequence, accountingArchive,
};
