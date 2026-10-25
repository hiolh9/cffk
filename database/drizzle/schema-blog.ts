import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./schema-tables-a";

export const blogPost = sqliteTable(
  "blogPost",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    contentHtml: text("contentHtml").notNull(),
    coverImage: text("coverImage"),
    status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
      .notNull()
      .default("DRAFT"),
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    seoKeywords: text("seoKeywords"),
    canonicalUrl: text("canonicalUrl"),
    /** BlogPosting | Article | FAQPage */
    schemaType: text("schemaType", { enum: ["BlogPosting", "Article", "FAQPage"] })
      .notNull()
      .default("BlogPosting"),
    /** Optional FAQ pairs: [{"question":"...","answer":"..."}] */
    faqJson: text("faqJson"),
    /** Optional full JSON-LD object/array; when set, used instead of auto schema */
    customSchemaJson: text("customSchemaJson"),
    authorName: text("authorName"),
    publishedAt: integer("publishedAt", { mode: "timestamp_ms" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("blogPost_slug_unique").on(table.slug),
    index("blogPost_status_publishedAt_idx").on(table.status, table.publishedAt),
  ],
);
