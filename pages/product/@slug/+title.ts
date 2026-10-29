export default function title(pageContext: {
  data?: { name?: string; seoTitle?: string | null };
  site?: { name?: string };
}) {
  const siteName = pageContext.site?.name || "Sparkpay";
  const product = pageContext.data;
  if (!product?.name) return siteName;
  const seo = product.seoTitle?.trim();
  return seo || `${product.name} - ${siteName}`;
}
