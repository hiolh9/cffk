export default function title(pageContext: { site?: { name?: string } }) {
  const site = pageContext.site?.name || "Sparkpay";
  return `Privacy Policy / Dasar Privasi - ${site}`;
}
