import { env } from "cloudflare:workers";
import { listPublishedBlogPosts } from "@/server/blog/public";
import { withServerDataErrorHandling } from "@/server/error-handling";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  return withServerDataErrorHandling("page data: blog list", {}, async () => ({
    posts: await listPublishedBlogPosts(env.DB, 50),
  }));
}
