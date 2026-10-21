export default function title(pageContext: { site?: { name?: string } }) {
  const site = pageContext.site?.name || "Sparkpay";
  return `Sales & Refund Terms / Syarat Jualan - ${site}`;
}
