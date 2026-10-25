/** Build JSON-LD for blog posts. Prefer customSchemaJson when valid. */

export type BlogFaqItem = { question: string; answer: string };

export type BlogSeoInput = {
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string;
  coverImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  schemaType: "BlogPosting" | "Article" | "FAQPage";
  faqJson: string | null;
  customSchemaJson: string | null;
  authorName: string | null;
  publishedAt: Date | number | null;
  updatedAt: Date | number | null;
  siteName: string;
  siteUrl: string;
  pageUrl: string;
};

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseFaqJson(raw: string | null | undefined): BlogFaqItem[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const q = String((item as { question?: unknown }).question ?? "").trim();
        const a = String((item as { answer?: unknown }).answer ?? "").trim();
        if (!q || !a) return null;
        return { question: q, answer: a };
      })
      .filter((x): x is BlogFaqItem => Boolean(x));
  } catch {
    return [];
  }
}

export function buildBlogJsonLd(input: BlogSeoInput): unknown[] {
  if (input.customSchemaJson?.trim()) {
    try {
      const custom = JSON.parse(input.customSchemaJson) as unknown;
      if (Array.isArray(custom)) return custom;
      if (custom && typeof custom === "object") return [custom];
    } catch {
      /* fall through to auto */
    }
  }

  const nodes: unknown[] = [];
  const description =
    input.seoDescription?.trim()
    || input.excerpt?.trim()
    || stripHtml(input.contentHtml).slice(0, 160);
  const headline = input.seoTitle?.trim() || input.title;
  const datePublished = toIso(input.publishedAt);
  const dateModified = toIso(input.updatedAt) || datePublished;

  if (input.schemaType === "FAQPage") {
    const faqs = parseFaqJson(input.faqJson);
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  } else {
    nodes.push({
      "@context": "https://schema.org",
      "@type": input.schemaType,
      headline,
      description,
      image: input.coverImage || undefined,
      datePublished,
      dateModified,
      author: {
        "@type": "Person",
        name: input.authorName?.trim() || input.siteName,
      },
      publisher: {
        "@type": "Organization",
        name: input.siteName,
        url: input.siteUrl,
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": input.pageUrl,
      },
      url: input.pageUrl,
    });
  }

  // Breadcrumb: Home > Blog > Article
  nodes.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: input.siteUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${input.siteUrl.replace(/\/$/, "")}/blog` },
      { "@type": "ListItem", position: 3, name: input.title, item: input.pageUrl },
    ],
  });

  return nodes;
}

export function stringifyJsonLd(nodes: unknown[]): string {
  return JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
}
