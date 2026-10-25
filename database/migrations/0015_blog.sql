-- Blog posts with SEO fields (optional schema overrides)
CREATE TABLE `blogPost` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `slug` text NOT NULL,
  `excerpt` text,
  `contentHtml` text NOT NULL,
  `coverImage` text,
  `status` text DEFAULT 'DRAFT' NOT NULL,
  `seoTitle` text,
  `seoDescription` text,
  `seoKeywords` text,
  `canonicalUrl` text,
  `schemaType` text DEFAULT 'BlogPosting' NOT NULL,
  `faqJson` text,
  `customSchemaJson` text,
  `authorName` text,
  `publishedAt` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE UNIQUE INDEX `blogPost_slug_unique` ON `blogPost` (`slug`);
CREATE INDEX `blogPost_status_publishedAt_idx` ON `blogPost` (`status`, `publishedAt`);
