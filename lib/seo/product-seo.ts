/** Helpers for product-level SEO overrides. */

export type ProductSeoFields = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  customSchemaJson?: string | null;
};

export function parseProductCustomSchema(raw: string | null | undefined): unknown[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
    return null;
  } catch {
    return null;
  }
}

export function productMetaTitle(
  productName: string,
  siteName: string,
  seoTitle?: string | null,
) {
  const custom = seoTitle?.trim();
  return custom || `${productName} - ${siteName}`;
}

export function productMetaDescription(
  input: {
    seoDescription?: string | null;
    subtitle?: string | null;
    description?: string | null;
    fallback?: string;
  },
) {
  const custom = input.seoDescription?.trim();
  if (custom) return custom.slice(0, 160);
  if (input.subtitle?.trim()) return input.subtitle.trim().slice(0, 160);
  if (input.description) {
    return input.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  }
  return input.fallback || "";
}
