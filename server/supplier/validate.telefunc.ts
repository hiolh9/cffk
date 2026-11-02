import { eq } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { appError } from "@/lib/app-error";
import { createDrizzleDb } from "@/database/drizzle";
import { productSku, supplierBinding, supplierAccount } from "@/database/drizzle/schema";
import { createSupplierAdapterFromAccount } from "@/server/supplier/providers/factory";
import { MoogoldAdapter } from "@/server/supplier/providers/moogold";
// 改成你项目里「要求已登录」的函数：
import { requireUser } from "@/server/telefunc-context";

export const onValidateSupplierAccount = telefuncAction(
  async (input: { productSkuId: number; fields: Record<string, string> }) => {
    const { database } = requireUser(); // 若返回值不同，改成你的
    const db = createDrizzleDb(database);

    const skuId = Number(input.productSkuId);
    if (!Number.isInteger(skuId) || skuId <= 0) appError("VALIDATION_FAILED");

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.fields ?? {})) {
      const key = String(k).trim().slice(0, 64);
      const val = String(v ?? "").trim().slice(0, 200);
      if (key && val) fields[key] = val;
    }
    if (!Object.keys(fields).length) appError("VALIDATION_FAILED");

    const [sku] = await db
      .select()
      .from(productSku)
      .where(eq(productSku.id, skuId))
      .limit(1);

    if (!sku || sku.fulfillmentSource !== "SUPPLIER") {
      return { ok: true as const, skip: true as const, message: "not_supplier" };
    }

    // 按你表结构取 binding（示例）
    const [binding] = await db
      .select()
      .from(supplierBinding)
      .where(eq(supplierBinding.id, sku.supplierBindingId)) // 列名以你库为准
      .limit(1);

    if (!binding || binding.provider !== "moogold") {
      return { ok: true as const, skip: true as const, message: "not_moogold" };
    }

    const [account] = await db
      .select()
      .from(supplierAccount)
      .where(eq(supplierAccount.id, binding.supplierAccountId))
      .limit(1);

    if (!account) return { ok: false as const, message: "Supplier account missing" };

    const adapter = await createSupplierAdapterFromAccount(account);
    if (!(adapter instanceof MoogoldAdapter)) {
      return { ok: true as const, skip: true as const, message: "not_moogold_adapter" };
    }

    const productId = String(binding.upstreamSkuId || binding.upstreamProductId);
    const result = await adapter.validateAccount({ productId, fields });

    if (result.ok) {
      return {
        ok: true as const,
        skip: false as const,
        username: result.username,
        message: result.message,
      };
    }
    return { ok: false as const, message: result.message, code: result.code };
  },
);
