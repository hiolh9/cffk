import { render } from "vike/abort";
import { env } from "cloudflare:workers";
import { getPublishedBlogPostBySlug } from "@/server/blog/public";
import { withServerDataErrorHandling } from "@/server/error-handling";
import type { PageContextServer } from "vike/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer & { routeParams: { slug: string } }) {
  return withServerDataErrorHandling("page data: blog post", pageContext, async () => {
    const post = await getPublishedBlogPostBySlug(env.DB, pageContext.routeParams.slug);
    if (!post) throw render(404);
    return { post };
  });
}
