export default function title(pageContext: { site?: { name?: string } }) {
  const site = pageContext.site?.name || "Sparkpay";
  return `Terms of Use / Syarat Penggunaan - ${site}`;
}
