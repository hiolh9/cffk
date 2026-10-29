export default function title(pageContext: {
  data?: { post?: { title?: string; seoTitle?: string | null } };
  site?: { name?: string };
}) {
  const siteName = pageContext.site?.name || "Sparkpay";
  const post = pageContext.data?.post;
  if (!post?.title) return siteName;
  const seo = post.seoTitle?.trim();
  return seo ? `${seo}` : `${post.title} - ${siteName}`;
}
