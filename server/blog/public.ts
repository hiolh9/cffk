import { and, desc, eq } from "drizzle-orm";
import { createDrizzleDb } from "@/database/drizzle";
import { blogPost } from "@/database/drizzle/schema";

export type PublicBlogListItem = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  authorName: string | null;
};

export type PublicBlogPost = PublicBlogListItem & {
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  schemaType: "BlogPosting" | "Article" | "FAQPage";
  faqJson: string | null;
  customSchemaJson: string | null;
  updatedAt: Date;
};

export async function listPublishedBlogPosts(database: D1Database, limit = 50): Promise<PublicBlogListItem[]> {
  const db = createDrizzleDb(database);
  const rows = await db
    .select({
      id: blogPost.id,
      title: blogPost.title,
      slug: blogPost.slug,
      excerpt: blogPost.excerpt,
      coverImage: blogPost.coverImage,
      publishedAt: blogPost.publishedAt,
      authorName: blogPost.authorName,
    })
    .from(blogPost)
    .where(eq(blogPost.status, "PUBLISHED"))
    .orderBy(desc(blogPost.publishedAt), desc(blogPost.id))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows;
}

export async function getPublishedBlogPostBySlug(database: D1Database, slug: string): Promise<PublicBlogPost | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const db = createDrizzleDb(database);
  const [row] = await db
    .select()
    .from(blogPost)
    .where(and(eq(blogPost.slug, normalized), eq(blogPost.status, "PUBLISHED")))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    publishedAt: row.publishedAt,
    authorName: row.authorName,
    contentHtml: row.contentHtml,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoKeywords: row.seoKeywords,
    canonicalUrl: row.canonicalUrl,
    schemaType: row.schemaType,
    faqJson: row.faqJson,
    customSchemaJson: row.customSchemaJson,
    updatedAt: row.updatedAt,
  };
}
