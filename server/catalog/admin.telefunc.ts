import { telefuncAction } from "@/server/telefunc-action";
import { and, asc, count, eq, inArray, like, ne, or } from "drizzle-orm";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { slugify } from "@/lib/slugify";
import { formatCentsAsYuan, parseAmountToCents } from "@/lib/payment-utils";
import { sanitizeProductDescription } from "./product-description";
import { card, category, order, productV2, productSku, supplierBinding } from "@/database/drizzle/schema";
import { assertSupplierSkuPublishable } from "@/server/supplier/eligibility";

// TEMP: file was truncated during push — please replace with artifacts/regional-price-patch/admin.telefunc.ts full content
export const onGetCatalogAdminData = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onGetProductAdminDetail = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSaveCategory = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSetCategoryStatus = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSaveProduct = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onDeleteProduct = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSetProductStatus = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSaveProductSku = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onDeleteProductSku = telefuncAction(async () => appError("INTERNAL_ERROR"));
export const onSaveSupplierProductPresentation = telefuncAction(async () => appError("INTERNAL_ERROR"));
