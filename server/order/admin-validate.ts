/**
 * server/order/admin-validate.ts
 * Shared pre-order validate for admin manual orders (MooGold).
 */
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { supplierAccount, supplierBinding, productSku } from "@/database/drizzle/schema";
import { createSupplierAdapterFromAccount } from "@/server/supplier/providers/factory";
import { MoogoldAdapter } from "@/server/supplier/providers/moogold";
import { appError } from "@/lib/app-error";

export function normalizeAdminContactEmail(raw: string | undefined | null): string {
  const v = (raw ?? "").trim();
  if (!v || v === "-" || v.toLowerCase() === "n/a" || v.toLowerCase() === "none") {
    return "internal@admin.local";
  }
  if (!v.includes("@")) appError("EMAIL_INVALID");
  return v.toLowerCase();
}

/** Validate supplier account fields before admin creates a SUPPLIER order. */
export async function assertAdminSupplierValidate(
  database: D1Database,
  productSkuId: number,
  fields: Record<string, string>,
) {
  const db = createDrizzleDb(database);
  const [sku] = await db
    .select({ id: productSku.id, fulfillmentSource: productSku.fulfillmentSource })
    .from(productSku)
    .where(eq(productSku.id, productSkuId))
    .limit(1);
  if (!sku) appError("PRODUCT_SKU_NOT_FOUND");
  if ((sku.fulfillmentSource ?? "LOCAL") !== "SUPPLIER") return { skipped: true as const };

  const filled = Object.fromEntries(
    Object.entries(fields || {}).map(([k, v]) => [k, String(v ?? "").trim()]).filter(([, v]) => v),
  );
  if (!Object.keys(filled).length) appError("SUPPLIER_VALIDATE_FIELDS_REQUIRED");

  const [binding] = await db
    .select()
    .from(supplierBinding)
    .where(and(eq(supplierBinding.productSkuId, productSkuId), eq(supplierBinding.enabled, true)))
    .limit(1);
  if (!binding) appError("SUPPLIER_BINDING_MISSING");
  if (binding.provider !== "moogold") return { skipped: true as const, reason: "not_moogold" as const };

  const now = new Date();
  const accounts = await db
    .select()
    .from(supplierAccount)
    .where(
      and(
        eq(supplierAccount.provider, binding.provider),
        eq(supplierAccount.normalizedApiOrigin, binding.normalizedApiOrigin),
        eq(supplierAccount.protocolVersion, binding.protocolVersion),
        eq(supplierAccount.enabled, true),
        or(isNull(supplierAccount.cooldownUntil), lte(supplierAccount.cooldownUntil, now)),
      ),
    )
    .limit(5);
  if (!accounts.length) appError("SUPPLIER_ACCOUNT_MISSING");

  const productId = String(binding.upstreamSkuId || binding.upstreamProductId).trim();
  if (!productId) appError("UPSTREAM_PRODUCT_MISSING");

  let lastMessage = "Account validation failed";
  for (const account of accounts) {
    try {
      const adapter = await createSupplierAdapterFromAccount(account);
      if (!(adapter instanceof MoogoldAdapter)) continue;
      const result = await adapter.validateAccount({ productId, fields: filled });
      if (result.ok) return { skipped: false as const, username: result.username, message: result.message };
      lastMessage = result.message;
      appError("SUPPLIER_VALIDATE_FAILED");
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) throw e;
      lastMessage = e instanceof Error ? e.message : lastMessage;
    }
  }
  appError("SUPPLIER_VALIDATE_FAILED");
}
