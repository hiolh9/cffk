import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { telefuncAction } from "@/server/telefunc-action";
import { requireAdmin } from "@/server/telefunc-context";
import { appError } from "@/lib/app-error";
import { blogPost } from "@/database/drizzle/schema";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type BlogStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SchemaType = "BlogPosting" | "Article" | "FAQPage";

type BlogInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  contentHtml: string;
  coverImage?: string | null;
  status: BlogStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  schemaType?: SchemaType;
  faqJson?: string | null;
  customSchemaJson?: string | null;
  authorName?: string | null;
};

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateInput(input: BlogInput) {
  const title = input.title?.trim() ?? "";
  if (!title || title.length > 200) appError("BLOG_TITLE_INVALID");
  const slug = normalizeSlug(input.slug || title);
  if (!slug || !SLUG_RE.test(slug) || slug.length > 120) appError("BLOG_SLUG_INVALID");
  const contentHtml = input.contentHtml?.trim() ?? "";
  if (!contentHtml) appError("BLOG_CONTENT_REQUIRED");
  if (contentHtml.length > 500_000) appError("BLOG_CONTENT_TOO_LARGE");
  const status = input.status;
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") appError("BLOG_STATUS_INVALID");
  const schemaType = input.schemaType ?? "BlogPosting";
  if (schemaType !== "BlogPosting" && schemaType !== "Article" && schemaType !== "FAQPage") {
    appError("BLOG_SCHEMA_TYPE_INVALID");
  }
  if (input.customSchemaJson?.trim()) {
    try {
      JSON.parse(input.customSchemaJson);
    } catch {
      appError("BLOG_CUSTOM_SCHEMA_INVALID");
    }
  }
  if (input.faqJson?.trim()) {
    try {
      const parsed = JSON.parse(input.faqJson);
      if (!Array.isArray(parsed)) appError("BLOG_FAQ_INVALID");
    } catch {
      appError("BLOG_FAQ_INVALID");
    }
  }
  return {
    title,
    slug,
    excerpt: input.excerpt?.trim() || null,
    contentHtml,
    coverImage: input.coverImage?.trim() || null,
    status,
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
    seoKeywords: input.seoKeywords?.trim() || null,
    canonicalUrl: input.canonicalUrl?.trim() || null,
    schemaType,
    faqJson: input.faqJson?.trim() || null,
    customSchemaJson: input.customSchemaJson?.trim() || null,
    authorName: input.authorName?.trim() || null,
  };
}

async function internalOnListBlogPosts(input?: { query?: string; status?: string }) {
  const { db } = requireAdmin();
  const q = input?.query?.trim().toLowerCase() ?? "";
  const status = input?.status;
  const conditions = [];
  if (status === "DRAFT" || status === "PUBLISHED" || status === "ARCHIVED") {
    conditions.push(eq(blogPost.status, status));
  }
  if (q) {
    conditions.push(or(like(blogPost.title, `%${q}%`), like(blogPost.slug, `%${q}%`)));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: blogPost.id,
      title: blogPost.title,
      slug: blogPost.slug,
      status: blogPost.status,
      schemaType: blogPost.schemaType,
      publishedAt: blogPost.publishedAt,
      updatedAt: blogPost.updatedAt,
      authorName: blogPost.authorName,
    })
    .from(blogPost)
    .where(where)
    .orderBy(desc(blogPost.updatedAt), desc(blogPost.id))
    .limit(200);
  return { items: rows };
}

async function internalOnGetBlogPost(input: { id: number }) {
  const { db } = requireAdmin();
  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) appError("BLOG_NOT_FOUND");
  const [row] = await db.select().from(blogPost).where(eq(blogPost.id, id)).limit(1);
  if (!row) appError("BLOG_NOT_FOUND");
  return row;
}

async function internalOnCreateBlogPost(input: BlogInput) {
  const { db } = requireAdmin();
  const data = validateInput(input);
  const now = new Date();
  const publishedAt = data.status === "PUBLISHED" ? now : null;
  try {
    const result = await db
      .insert(blogPost)
      .values({
        ...data,
        publishedAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: blogPost.id });
    return { id: result[0]!.id };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) appError("BLOG_SLUG_TAKEN");
    throw cause;
  }
}

async function internalOnUpdateBlogPost(input: BlogInput & { id: number }) {
  const { db } = requireAdmin();
  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) appError("BLOG_NOT_FOUND");
  const data = validateInput(input);
  const [existing] = await db.select({ id: blogPost.id, status: blogPost.status, publishedAt: blogPost.publishedAt }).from(blogPost).where(eq(blogPost.id, id)).limit(1);
  if (!existing) appError("BLOG_NOT_FOUND");
  const now = new Date();
  let publishedAt = existing.publishedAt;
  if (data.status === "PUBLISHED" && !publishedAt) publishedAt = now;
  if (data.status !== "PUBLISHED") {
    /* keep publishedAt history for republish */
  }
  try {
    await db
      .update(blogPost)
      .set({ ...data, publishedAt, updatedAt: now })
      .where(eq(blogPost.id, id));
    return { id };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) appError("BLOG_SLUG_TAKEN");
    throw cause;
  }
}

async function internalOnDeleteBlogPost(input: { id: number }) {
  const { db } = requireAdmin();
  const id = Number(input.id);
  if (!Number.isFinite(id) || id <= 0) appError("BLOG_NOT_FOUND");
  await db.delete(blogPost).where(eq(blogPost.id, id));
  return { ok: true as const };
}

export const onListBlogPosts = telefuncAction(internalOnListBlogPosts);
export const onGetBlogPost = telefuncAction(internalOnGetBlogPost);
export const onCreateBlogPost = telefuncAction(internalOnCreateBlogPost);
export const onUpdateBlogPost = telefuncAction(internalOnUpdateBlogPost);
export const onDeleteBlogPost = telefuncAction(internalOnDeleteBlogPost);

// silence unused if tree-shaken
void sql;
