import { telefuncAction } from "@/server/telefunc-action";
import { appError } from "@/lib/app-error";
import { supplierProviderSchema, supplierProtocolVersionSchema } from "./schema";
import { fetchSupplierCatalog } from "./catalog";
import { importSupplierProduct, switchSupplierBinding } from "./import";
import { requireAdminSecure } from "@/server/telefunc-context";

function parseImportInput(input: unknown) {
  if (!input || typeof input !== "object") appError("SUPPLIER_SOURCE_INPUT_INVALID");
  const value = input as Record<string, unknown>;
  const provider = supplierProviderSchema.safeParse(value.provider);
  const normalizedApiOrigin = typeof value.normalizedApiOrigin === "string" ? value.normalizedApiOrigin.trim() : "";
  const protocolVersion = supplierProtocolVersionSchema.safeParse(value.protocolVersion);
  const productId = typeof value.productId === "string" ? value.productId : "";
  const skuId = typeof value.skuId === "string" ? value.skuId : "";
  const categoryId = typeof value.categoryId === "number" ? value.categoryId : 0;
  if (!provider.success || !protocolVersion.success || !normalizedApiOrigin || !productId || !skuId || !Number.isInteger(categoryId) || categoryId < 1) {
    appError("SUPPLIER_SOURCE_INPUT_INVALID");
  }
  return { provider: provider.data, normalizedApiOrigin, protocolVersion: protocolVersion.data, productId, skuId, categoryId };
}

export const onImportSupplierProduct = telefuncAction(async (input: unknown) => {
  const { db } = await requireAdminSecure();
  const parsed = parseImportInput(input);
  const result = await fetchSupplierCatalog(
    { provider: parsed.provider, normalizedApiOrigin: parsed.normalizedApiOrigin, protocolVersion: parsed.protocolVersion },
    "",
    1,
  );
  const product = result.products.find((item) => item.id === parsed.productId);
  if (!product) appError("SUPPLIER_PRODUCT_NOT_FOUND");
  return importSupplierProduct(db, parsed, product);
});

export const onSwitchSupplierBinding = telefuncAction(async (input: unknown) => {
  const { db } = await requireAdminSecure();
  if (!input || typeof input !== "object") appError("SUPPLIER_SOURCE_INPUT_INVALID");
  const value = input as Record<string, unknown>;
  const provider = supplierProviderSchema.safeParse(value.provider);
  const normalizedApiOrigin = typeof value.normalizedApiOrigin === "string" ? value.normalizedApiOrigin.trim() : "";
  const protocolVersion = supplierProtocolVersionSchema.safeParse(value.protocolVersion);
  const productSkuId = typeof value.productSkuId === "number" ? value.productSkuId : 0;
  const productId = typeof value.productId === "string" ? value.productId : "";
  const skuId = typeof value.skuId === "string" ? value.skuId : "";
  if (!provider.success || !protocolVersion.success || !normalizedApiOrigin || !Number.isInteger(productSkuId) || productSkuId < 1 || !productId || !skuId) {
    appError("SUPPLIER_SOURCE_INPUT_INVALID");
  }
  const result = await fetchSupplierCatalog({ provider: provider.data, normalizedApiOrigin, protocolVersion: protocolVersion.data }, "", 1);
  const product = result.products.find((item) => item.id === productId);
  if (!product) appError("SUPPLIER_PRODUCT_NOT_FOUND");
  return switchSupplierBinding(db, { productSkuId, provider: provider.data, normalizedApiOrigin, protocolVersion: protocolVersion.data, productId, skuId }, product);
});
