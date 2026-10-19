import { and, asc, eq, like, or } from "drizzle-orm";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { productSku, productV2, supplierAccount, supplierBinding, supplierSyncSettings } from "@/database/drizzle/schema";
import { createSupplierAdapterFromAccount } from "./providers/factory";
import { normalizeLegacyProtocolVersion, supplierPurchaseContextSchema, type SupplierProvider } from "./schema";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

async function ensureSyncSettings(db: ReturnType<typeof requireAdmin>["db"], patch: { lastStartedAt?: Date; lastCompletedAt?: Date | null; lastStatus?: "idle" | "running" | "success" | "failed"; lastError?: string | null }) {
  const [existing] = await db.select({ id: supplierSyncSettings.id }).from(supplierSyncSettings).where(eq(supplierSyncSettings.id, 1)).limit(1);
  if (existing) {
    await db.update(supplierSyncSettings).set({ ...patch, updatedAt: new Date() }).where(eq(supplierSyncSettings.id, 1));
  } else {
    const now = new Date();
    await db.insert(supplierSyncSettings).values({ id: 1, enabled: true, intervalMs: 3_600_000, lastStartedAt: patch.lastStartedAt, lastCompletedAt: patch.lastCompletedAt ?? null, lastStatus: patch.lastStatus ?? "idle", lastError: patch.lastError ?? null, createdAt: now, updatedAt: now });
  }
}

export async function listSupplierSources() {
  const { db } = requireAdmin();
  const accounts = await db.select({ provider: supplierAccount.provider, normalizedApiOrigin: supplierAccount.normalizedApiOrigin, protocolVersion: supplierAccount.protocolVersion, name: supplierAccount.name }).from(supplierAccount).where(eq(supplierAccount.enabled, true)).orderBy(asc(supplierAccount.name));
  const seen = new Set<string>();
  return accounts.filter((a) => {
    const key = `${a.provider}|${a.normalizedApiOrigin}|${a.protocolVersion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchSupplierCatalog(source: { provider: SupplierProvider; normalizedApiOrigin: string; protocolVersion: string }, search = "", page = 1, pageSize = DEFAULT_PAGE_SIZE, forceRefresh = false) {
  const { db } = requireAdmin();
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
  const [account] = await db.select().from(supplierAccount).where(and(eq(supplierAccount.provider, source.provider), eq(supplierAccount.normalizedApiOrigin, source.normalizedApiOrigin), eq(supplierAccount.enabled, true))).orderBy(asc(supplierAccount.id)).limit(1);
  if (!account) appError("SUPPLIER_ACCOUNT_NOT_FOUND");
  const adapter = await createSupplierAdapterFromAccount(account);
  const products = await adapter.listProducts({ search, page, pageSize: size });
  return { products: products.items ?? products, page, pageSize: size };
}

export async function getSupplierSourceBindingCount(source: { provider: SupplierProvider; normalizedApiOrigin: string; protocolVersion: string }) {
  const { db } = requireAdmin();
  const rows = await db.select({ id: supplierBinding.id }).from(supplierBinding).where(and(eq(supplierBinding.provider, source.provider), eq(supplierBinding.normalizedApiOrigin, source.normalizedApiOrigin)));
  return { count: rows.length };
}

export async function syncSupplierSource(source: { provider: SupplierProvider; normalizedApiOrigin: string; protocolVersion: string }) {
  const { db } = requireAdmin();
  await ensureSyncSettings(db, { lastStartedAt: new Date(), lastStatus: "running", lastError: null });
  try {
    const [account] = await db.select().from(supplierAccount).where(and(eq(supplierAccount.provider, source.provider), eq(supplierAccount.normalizedApiOrigin, source.normalizedApiOrigin), eq(supplierAccount.enabled, true))).limit(1);
    if (!account) appError("SUPPLIER_ACCOUNT_NOT_FOUND");
    const adapter = await createSupplierAdapterFromAccount(account);
    await adapter.listProducts({ page: 1, pageSize: 1 });
    await ensureSyncSettings(db, { lastCompletedAt: new Date(), lastStatus: "success", lastError: null });
    return { ok: true };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "sync_failed";
    await ensureSyncSettings(db, { lastCompletedAt: new Date(), lastStatus: "failed", lastError: message });
    throw cause;
  }
}

export async function loadSupplierBindings(input: { provider?: SupplierProvider; normalizedApiOrigin?: string; search?: string } = {}) {
  const { db } = requireAdmin();
  const conditions = [];
  if (input.provider) conditions.push(eq(supplierBinding.provider, input.provider));
  if (input.normalizedApiOrigin) conditions.push(eq(supplierBinding.normalizedApiOrigin, input.normalizedApiOrigin));
  if (input.search?.trim()) conditions.push(like(supplierBinding.upstreamSkuName, `%${input.search.trim()}%`));
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(supplierBinding).where(where).orderBy(asc(supplierBinding.id)).limit(200);
}

export async function loadSupplierBindingTargets() {
  const { db } = requireAdmin();
  return db.select({ id: productSku.id, productId: productSku.productId, productName: productV2.name }).from(productSku).innerJoin(productV2, eq(productV2.id, productSku.productId)).orderBy(asc(productV2.name)).limit(500);
}
