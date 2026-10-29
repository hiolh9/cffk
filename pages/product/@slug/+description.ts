function toPlainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

export default function description(pageContext: {
  data?: {
    seoDescription?: string | null;
    subtitle?: string | null;
    description?: string | null;
  };
  site?: { subtitle?: string | null };
}) {
  const product = pageContext.data;
  return (
    product?.seoDescription?.trim() ||
    product?.subtitle?.trim() ||
    (product?.description ? toPlainText(product.description) : "") ||
    pageContext.site?.subtitle ||
    "Digital top-up store"
  );
}
