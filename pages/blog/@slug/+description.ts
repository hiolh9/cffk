function plain(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "";
}

export default function description(pageContext: {
  data?: {
    post?: {
      seoDescription?: string | null;
      excerpt?: string | null;
      contentHtml?: string;
    };
  };
  site?: { subtitle?: string | null };
}) {
  const post = pageContext.data?.post;
  return (
    post?.seoDescription?.trim() ||
    post?.excerpt?.trim() ||
    plain(post?.contentHtml) ||
    pageContext.site?.subtitle ||
    "Blog"
  );
}
