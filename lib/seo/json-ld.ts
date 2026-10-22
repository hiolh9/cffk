/** JSON-LD builders for storefront SEO (Schema.org). */

export type ProductJsonLdInput = {
  name: string;
  slug: string;
  description?: string | null;
  subtitle?: string | null;
  coverImage?: string | null;
  categoryName?: string | null;
  /** Display price string, e.g. "12.90" */
  price: string;
  /** Lowest SKU price if multiple; same format as price */
  lowPrice?: string;
  highPrice?: string;
  /** null = unlimited / supplier; 0 = out of stock; >0 = in stock */
  availableStock: number | null;
  /** Optional 1.0–5.0; only emitted when reviewCount >= 1 */
  ratingValue?: string | number | null;
  reviewCount?: number | null;
  currency?: string;
  siteName: string;
  siteUrl: string;
  productUrl: string;
};

function toPlainText(value: string | null | undefined, max = 5000) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function absoluteUrl(value: string | null | undefined, origin: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, origin.endsWith("/") ? origin : `${origin}/`).toString();
  } catch {
    return undefined;
  }
}

function availability(stock: number | null): "https://schema.org/InStock" | "https://schema.org/OutOfStock" {
  if (stock === null) return "https://schema.org/InStock";
  return stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

function parseRating(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n * 10) / 10;
}

/** Build Schema.org Product (+ optional AggregateRating) and BreadcrumbList. */
export function buildProductJsonLd(input: ProductJsonLdInput): object[] {
  const origin = input.siteUrl.replace(/\/$/, "");
  const currency = input.currency || "MYR";
  const description =
    toPlainText(input.subtitle, 300) || toPlainText(input.description, 5000) || input.name;
  const image = absoluteUrl(input.coverImage, origin);

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: input.productUrl,
    priceCurrency: currency,
    price: input.price,
    availability: availability(input.availableStock),
    itemCondition: "https://schema.org/NewCondition",
  };

  if (input.lowPrice && input.highPrice && input.lowPrice !== input.highPrice) {
    offer.price = undefined;
    offer.priceSpecification = {
      "@type": "PriceSpecification",
      priceCurrency: currency,
      minPrice: input.lowPrice,
      maxPrice: input.highPrice,
    };
  }

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description,
    sku: input.slug,
    url: input.productUrl,
    brand: {
      "@type": "Brand",
      name: input.siteName,
    },
    offers: offer,
  };

  if (image) product.image = [image];
  if (input.categoryName) product.category = input.categoryName;

  const rating = parseRating(input.ratingValue);
  const reviewCount =
    typeof input.reviewCount === "number" && Number.isInteger(input.reviewCount) && input.reviewCount > 0
      ? input.reviewCount
      : null;

  if (rating !== null && reviewCount !== null) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(rating),
      bestRating: "5",
      worstRating: "1",
      reviewCount: String(reviewCount),
    };
  }

  const breadcrumbItems: object[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: `${origin}/`,
    },
  ];

  if (input.categoryName) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: input.categoryName,
      item: `${origin}/`,
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: input.name,
      item: input.productUrl,
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: input.name,
      item: input.productUrl,
    });
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return [product, breadcrumb];
}

export function stringifyJsonLd(nodes: object[]): string {
  return JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
}
