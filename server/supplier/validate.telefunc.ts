import { and, eq, isNull, lte, or } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { appError } from "@/lib/app-error";
import { createDrizzleDb } from "@/database/drizzle";
import { productSku, supplierAccount, supplierBinding } from "@/database/drizzle/schema";
import { createSupplierAdapterFromAccount } from "@/server/supplier/providers/factory";
import { MoogoldAdapter } from "@/server/supplier/providers/moogold";
import { requireUser } from "@/server/telefunc-context";

/**
 * Pre-checkout: MooGold product/validate with dynamic account fields.
 * Non-supplier / non-moogold → { ok: true, skip: true }.
 */
export const onValidateSupplierAccount = telefuncAction(
  async (input: { productSkuId: number; fields: Record<string, string> }) => {
    const { database } = requireUser();
    const db = createDrizzleDb(database);

    const skuId = Number(input.productSkuId);
    if (!Number.isInteger(skuId) || skuId <= 0) appError("VALIDATION_FAILED");

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.fields ?? {})) {
      const key = String(k).trim().slice(0, 64);
      const val = String(v ?? "").trim().slice(0, 200);
      if (key && val) fields[key] = val;
    }
    if (!Object.keys(fields).length) {
      return { ok: true as const, skip: true as const, message: "no_fields" };
    }

    const [sku] = await db.select().from(productSku).where(eq(productSku.id, skuId)).limit(1);
    if (!sku || sku.fulfillmentSource !== "SUPPLIER") {
      return { ok: true as const, skip: true as const, message: "not_supplier" };
    }

    const [binding] = await db
      .select()
      .from(supplierBinding)
      .where(and(eq(supplierBinding.productSkuId, skuId), eq(supplierBinding.enabled, true)))
      .limit(1);

    if (!binding) {
      return { ok: true as const, skip: true as const, message: "no_binding" };
    }
    if (binding.provider !== "moogold") {
      return { ok: true as const, skip: true as const, message: "not_moogold" };
    }

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

    if (!accounts.length) {
      return { ok: false as const, message: "Supplier account unavailable", code: "supplier_account_missing" };
    }

    const productId = String(binding.upstreamSkuId || binding.upstreamProductId).trim();
    if (!productId) {
      return { ok: false as const, message: "Missing upstream product id", code: "upstream_product_missing" };
    }

    let lastMessage = "Account validation failed";
    let lastCode = "moogold_validate_failed";

    for (const account of accounts) {
      try {
        const adapter = await createSupplierAdapterFromAccount(account);
        if (!(adapter instanceof MoogoldAdapter)) {
          return { ok: true as const, skip: true as const, message: "not_moogold_adapter" };
        }
        const result = await adapter.validateAccount({ productId, fields });
        if (result.ok) {
          return {
            ok: true as const,
            skip: false as const,
            username: result.username,
            message: result.message,
          };
        }
        lastMessage = result.message;
        lastCode = result.code ?? lastCode;
        // Validation rejection is definitive — don't retry other accounts
        return { ok: false as const, message: lastMessage, code: lastCode };
      } catch (cause) {
        lastMessage = cause instanceof Error ? cause.message : lastMessage;
        lastCode = "moogold_validate_error";
      }
    }

    return { ok: false as const, message: lastMessage, code: lastCode };
  },
);
