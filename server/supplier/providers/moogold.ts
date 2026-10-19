import { createHmac } from "node:crypto";
import { SupplierDomainError } from "../error";
import { decimalToMinor } from "../money";
import type { SupplierPurchaseResult } from "../schema";
import { supplierFetchJson } from "./http";
import type { SupplierAdapter, SupplierProduct, SupplierPurchaseContext, SupplierSku } from "./types";

const DEFAULT_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
function pick(r: Record<string, unknown>, keys: string[]) { for (const k of keys) { const v = asStr(r[k]); if (v) return v; } return null; }
function pickN(r: Record<string, unknown>, keys: string[]) { for (const k of keys) { const raw = r[k]; if (typeof raw === "number" && Number.isFinite(raw)) return raw; if (typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw); } return null; }
function money(v: string) { const t = v.replace(/,/g, "").trim(); return /^(0|[1-9]\d*)(\.\d+)?$/.test(t) ? t : "0"; }
function unwrap(body: unknown) { if (!isRec(body)) return {}; if (isRec(body.data)) return body.data as Record<string, unknown>; if (isRec(body.result)) return body.result as Record<string, unknown>; return body; }
function isDone(s: string) { return ["completed", "complete", "success", "successful", "delivered", "done", "finished", "1"].includes(s); }
function isFail(s: string) { return ["failed", "fail", "cancelled", "canceled", "rejected", "error", "refunded"].includes(s); }
function isErr(body: unknown) { return isRec(body) && (body.success === false || body.ok === false); }
function cardsOf(r: Record<string, unknown>) { const d = pick(r, ["card", "cards", "code", "codes", "serial", "delivery", "voucher", "pin"]); return d ? d.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 10000) : []; }

/** MooGold Partner API (prepaid). https://doc.moogold.com/ */
export class MoogoldAdapter implements SupplierAdapter {
  private cache?: { at: number; products: SupplierProduct[] };
  constructor(private readonly input: { baseUrl: string; partnerId: string; secretKey: string; categoryIds?: number[]; currency: string; currencyDecimals: number; fetcher?: typeof fetch; now?: () => number }) {}

  async testConnection() {
    const body = await this.req("user/balance", {});
    const r = isRec(body) ? body : {};
    const amount = pick(r, ["balance", "credit", "credits", "amount", "available_balance"]) ?? (isRec(r.data) ? pick(r.data as Record<string, unknown>, ["balance", "credit", "credits", "amount"]) : null) ?? "0";
    return { siteName: "MooGold", balance: { amountMinor: decimalToMinor(money(amount), this.input.currencyDecimals), currency: this.input.currency } };
  }

  async listProducts(input: { page: number; pageSize: number; includeInactive?: boolean; forceRefresh?: boolean }) {
    const all = await this.catalog(Boolean(input.forceRefresh));
    const filtered = input.includeInactive ? all : all.filter((p) => p.active);
    const start = Math.max(0, (input.page - 1) * input.pageSize);
    return { products: filtered.slice(start, start + input.pageSize), total: filtered.length };
  }

  async getSku(productId: string, skuId: string): Promise<SupplierSku> {
    const detail = await this.detail(productId);
    const sku = detail.skus.find((s) => s.id === skuId) ?? detail.skus.find((s) => s.id === productId);
    if (!sku) throw new SupplierDomainError("supplier_sku_not_found", 404, "Supplier SKU was not found");
    return sku;
  }

  async submitOrder(input: { skuId: string; quantity: number; requestNo: string; callbackUrl: string; traceId: string; purchaseContext?: SupplierPurchaseContext }): Promise<SupplierPurchaseResult> {
    const category = asStr(input.purchaseContext?.code) ?? asStr(input.purchaseContext?.widget?.category) ?? asStr(input.purchaseContext?.widget?.Category) ?? "1";
    const data: Record<string, string | number> = { category: Number(category) || category, "product-id": /^\d+$/.test(input.skuId) ? Number(input.skuId) : input.skuId, quantity: input.quantity };
    for (const [k, v] of Object.entries(input.purchaseContext?.widget ?? {})) {
      if (k === "category" || k === "Category" || k === "product-id" || v == null || v === "") continue;
      data[k] = v;
    }
    try {
      const body = await this.req("order/create_order", data, input.requestNo);
      const r = unwrap(body);
      const orderId = pick(r, ["order_id", "orderId", "id", "order_number", "order_no"]) ?? pick(isRec(body) ? body : {}, ["order_id", "orderId", "id"]);
      const status = (pick(r, ["status", "order_status", "state"]) ?? "processing").toLowerCase();
      if (isFail(status) || isErr(body)) return { status: "definitively_failed", errorCode: pick(r, ["error_code", "code", "message"]) ?? "moogold_order_rejected" };
      if (!orderId) return { status: "uncertain", upstreamOrderId: null, errorCode: "moogold_order_id_missing" };
      if (isDone(status)) { const cards = cardsOf(r); return { status: "supplied", upstreamOrderId: orderId, cards: cards.length ? cards : [`MooGold order ${orderId} completed`] }; }
      return { status: "processing", upstreamOrderId: orderId };
    } catch (cause) {
      if (cause instanceof SupplierDomainError && cause.status >= 400 && cause.status < 500) return { status: "definitively_failed", errorCode: cause.code };
      return { status: "uncertain", upstreamOrderId: null, errorCode: cause instanceof SupplierDomainError ? cause.code : "moogold_request_uncertain" };
    }
  }

  async reconcileOrder(input: { upstreamOrderId: string | null; skuId: string; quantity: number; requestNo: string; callbackUrl: string; traceId: string; purchaseContext?: SupplierPurchaseContext }): Promise<SupplierPurchaseResult> {
    if (!input.upstreamOrderId) return { status: "uncertain", upstreamOrderId: null, errorCode: "supplier_order_id_missing" };
    try {
      const body = await this.req("order/order_detail", { order_id: /^\d+$/.test(input.upstreamOrderId) ? Number(input.upstreamOrderId) : input.upstreamOrderId });
      const r = unwrap(body);
      const status = (pick(r, ["status", "order_status", "state"]) ?? "processing").toLowerCase();
      const orderId = pick(r, ["order_id", "orderId", "id"]) ?? input.upstreamOrderId;
      if (isFail(status)) return { status: "definitively_failed", errorCode: pick(r, ["error_code", "code", "message"]) ?? "moogold_order_failed" };
      if (isDone(status)) { const cards = cardsOf(r); return { status: "supplied", upstreamOrderId: orderId, cards: cards.length ? cards : [`MooGold order ${orderId} completed`] }; }
      return { status: "processing", upstreamOrderId: orderId };
    } catch (cause) {
      return { status: "uncertain", upstreamOrderId: input.upstreamOrderId, errorCode: cause instanceof SupplierDomainError ? cause.code : "moogold_reconcile_uncertain" };
    }
  }

  private async catalog(force: boolean) {
    const now = this.input.now?.() ?? Date.now();
    if (!force && this.cache && now - this.cache.at < 300_000) return this.cache.products;
    const ids = this.input.categoryIds?.length ? this.input.categoryIds : DEFAULT_CATEGORY_IDS;
    const products: SupplierProduct[] = [];
    const seen = new Set<string>();
    for (const categoryId of ids) {
      try {
        const body = await this.req("product/list_product", { category: categoryId });
        const items = Array.isArray(body) ? body : isRec(body) ? (Array.isArray(body.data) ? body.data : Array.isArray(body.products) ? body.products : Array.isArray(body.list) ? body.list : []) : [];
        for (const item of items) {
          const mapped = this.map(item, categoryId);
          if (mapped && !seen.has(mapped.id)) { seen.add(mapped.id); products.push(mapped); }
        }
      } catch { /* skip missing categories */ }
    }
    this.cache = { at: now, products };
    return products;
  }

  private async detail(productId: string) {
    const body = await this.req("product/product_detail", { product_id: /^\d+$/.test(productId) ? Number(productId) : productId });
    const mapped = this.map(unwrap(body), Number(pick(unwrap(body), ["category", "category_id"]) ?? 0) || 1);
    if (!mapped) throw new SupplierDomainError("supplier_product_not_found", 404, "Supplier product was not found");
    return mapped;
  }

  private map(raw: unknown, categoryId: number): SupplierProduct | null {
    if (!isRec(raw)) return null;
    const id = pick(raw, ["product_id", "product-id", "id", "variation_id", "variationId"]);
    if (!id) return null;
    const name = pick(raw, ["name", "product_name", "title", "product_title"]) ?? `MooGold #${id}`;
    const description = pick(raw, ["description", "detail", "product_description"]) ?? "";
    const image = pick(raw, ["image", "image_url", "img", "thumbnail"]);
    const priceRaw = pick(raw, ["price", "sale_price", "partner_price", "cost", "amount"]) ?? "0";
    const stock = pickN(raw, ["stock", "stock_quantity", "qty", "quantity"]) ?? (String(raw.stock_status ?? raw.status ?? "1").toLowerCase() === "out_of_stock" ? 0 : 999);
    const active = !["0", "false", "inactive", "disabled", "out_of_stock"].includes(String(raw.status ?? raw.stock_status ?? "1").toLowerCase());
    const vars = [raw.variations, raw.variation, raw.skus, raw.offers].find(Array.isArray) as unknown[] | undefined;
    const skus: SupplierSku[] = vars && vars.length
      ? vars.filter(isRec).map((v) => {
          const skuId = pick(v, ["variation_id", "variationId", "product_id", "product-id", "id"]) ?? id;
          return { id: skuId, name: pick(v, ["name", "title", "label"]) ?? name, costMinor: decimalToMinor(money(pick(v, ["price", "sale_price", "partner_price", "cost"]) ?? priceRaw), this.input.currencyDecimals), stockQuantity: Math.max(0, Math.floor(pickN(v, ["stock", "stock_quantity", "qty"]) ?? stock)), active, purchaseContext: { code: String(categoryId), widget: { category: String(categoryId) } } };
        })
      : [{ id, name, costMinor: decimalToMinor(money(priceRaw), this.input.currencyDecimals), stockQuantity: Math.max(0, Math.floor(stock)), active, purchaseContext: { code: String(categoryId), widget: { category: String(categoryId) } } }];
    return { id, name, description, imageUrls: image ? [image] : [], categoryNames: [String(categoryId)], active, skus };
  }

  private async req(path: string, data: Record<string, unknown>, partnerOrderId?: string) {
    const origin = this.input.baseUrl.replace(/\/+$/, "") || "https://moogold.com";
    const url = `${origin}/wp-json/v1/api/${path}`;
    const payloadObject: Record<string, unknown> = { path, data };
    if (partnerOrderId) payloadObject.partnerOrderId = partnerOrderId;
    const payload = JSON.stringify(payloadObject);
    const timestamp = String(Math.floor((this.input.now?.() ?? Date.now()) / 1000));
    const auth = createHmac("sha256", this.input.secretKey).update(payload + timestamp + path).digest("hex");
    const authBasic = btoa(`${this.input.partnerId}:${this.input.secretKey}`);
    const { status, body } = await supplierFetchJson(this.input.fetcher ?? fetch, url, { method: "POST", headers: { "Content-Type": "application/json", timestamp, auth, Authorization: `Basic ${authBasic}` }, body: payload });
    if (status === 401 || status === 403) throw new SupplierDomainError("supplier_account_auth_failed", status, "MooGold authentication failed");
    if (status >= 500) throw new SupplierDomainError("supplier_request_uncertain", 502, "MooGold request outcome is uncertain");
    if (status >= 400) throw new SupplierDomainError("moogold_request_failed", status, (isRec(body) && pick(body, ["message", "error", "err_msg"])) || "MooGold request was rejected");
    if (isErr(body)) throw new SupplierDomainError("moogold_request_failed", 400, (isRec(body) && pick(body, ["message", "error"])) || "MooGold request was rejected");
    return body;
  }
}
