import { z } from "zod";

import { slugify } from "@/lib/slugify";
import { normalizeBuyerFormForSave, parseBuyerFormJson, serializeBuyerForm } from "@/lib/buyer-form";

import type { onGetProductAdminDetail } from "@/server/catalog/admin.telefunc";

export const deliveryTypes = ["CARD_AUTO", "FIXED_CARD", "MANUAL", "EXPRESS"] as const;
export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productFormSchema = z.object({
  id: z.number().int().positive().optional(),
  categoryId: z
    .number({ error: "请选择商品分类" })
    .int()
    .refine((n) => n > 0, { message: "请选择商品分类" }),
  name: z.string().trim().min(1, "商品名称不能为空").max(120, "商品名称不能超过 120 个字符"),
  slug: z
    .string()
    .trim()
    .refine((s) => s === "" || slugPattern.test(s), {
      message: "Slug 只能包含小写英文、数字和连字符，或留空自动生成",
    }),
  subtitle: z.string().max(300, "副标题不能超过 300 个字符"),
  coverImage: z.string(),
  description: z.string().trim().min(1, "商品详情不能为空"),
  nameEn: z.string().max(120, "英文名称不能超过 120 个字符"),
  subtitleEn: z.string().max(300, "英文副标题不能超过 300 个字符"),
  descriptionEn: z.string(),
  seoTitleEn: z.string(),
  seoDescriptionEn: z.string(),
  manualDeliveryHint: z.string(),
  purchaseNote: z.string(),
  buyerFormJson: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  seoKeywords: z.string(),
  customSchemaJson: z.string(),
  ratingValue: z.string().trim().max(8),
  reviewCount: z.number().int().min(0).max(1_000_000),
  status: z.enum(productStatuses),
  sort: z.number().int().min(0),
});

export type ProductForm = z.infer<typeof productFormSchema>;
export type ProductDetail = Awaited<ReturnType<typeof onGetProductAdminDetail>>;

export function slugifyProductName(value: string) {
  return slugify(value);
}

export function defaultProductForm(categoryId: number | null = null): ProductForm {
  return {
    categoryId: categoryId ?? 0,
    name: "",
    slug: "",
    subtitle: "",
    coverImage: "",
    description: "",
    nameEn: "",
    subtitleEn: "",
    descriptionEn: "",
    seoTitleEn: "",
    seoDescriptionEn: "",
    manualDeliveryHint: "",
    purchaseNote: "",
    buyerFormJson: "",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    customSchemaJson: "",
    ratingValue: "",
    reviewCount: 0,
    status: "DRAFT",
    sort: 0,
  };
}

export function productDetailToForm(item: ProductDetail["product"]): ProductForm {
  const p = item as ProductDetail["product"] & {
    buyerFormJson?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string | null;
    customSchemaJson?: string | null;
  };
  return {
    id: item.id,
    categoryId: item.categoryId ?? 0,
    name: item.name,
    slug: item.slug,
    subtitle: item.subtitle ?? "",
    coverImage: item.coverImage ?? "",
    description: item.description ?? "",
    nameEn: (item as any).nameEn ?? "",
    subtitleEn: (item as any).subtitleEn ?? "",
    descriptionEn: (item as any).descriptionEn ?? "",
    seoTitleEn: (item as any).seoTitleEn ?? "",
    seoDescriptionEn: (item as any).seoDescriptionEn ?? "",
    manualDeliveryHint: item.manualDeliveryHint ?? "",
    purchaseNote: item.purchaseNote,
    buyerFormJson: p.buyerFormJson ?? "",
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    seoKeywords: p.seoKeywords ?? "",
    customSchemaJson: p.customSchemaJson ?? "",
    ratingValue: item.ratingValue ?? "",
    reviewCount: item.reviewCount ?? 0,
    status: item.status,
    sort: item.sort,
  };
}

export type ProductDeliveryType = (typeof deliveryTypes)[number];

export type ProductSkuDraftInput = {
  name: string;
  price: string;
  status: "ACTIVE" | "INACTIVE";
  deliveryType: ProductDeliveryType;
  fixedDeliveryContent: string;
  physicalStock: number | null;
  minBuy: number;
  maxBuy: number;
  sort: number;
};

export function formToSaveInput(
  form: ProductForm,
  skus: ProductSkuDraftInput[],
  deliveryType: ProductDeliveryType,
) {
  const autoSlug = slugifyProductName(form.name) || `product-${Date.now()}`;
  const slug = form.slug.trim() || autoSlug;

  let buyerFormJson: string | null = form.buyerFormJson?.trim() || null;
  if (buyerFormJson) {
    const normalized = normalizeBuyerFormForSave(parseBuyerFormJson(buyerFormJson));
    buyerFormJson = normalized.fields.length ? serializeBuyerForm(normalized) : null;
  }

  return {
    id: form.id,
    categoryId: form.categoryId || null,
    name: form.name,
    slug,
    subtitle: form.subtitle,
    coverImage: form.coverImage,
    description: form.description,
    nameEn: form.nameEn || null,
    subtitleEn: form.subtitleEn || null,
    descriptionEn: form.descriptionEn || null,
    seoTitleEn: form.seoTitleEn || null,
    seoDescriptionEn: form.seoDescriptionEn || null,
    manualDeliveryHint: form.manualDeliveryHint,
    purchaseNote: form.purchaseNote,
    buyerFormJson,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null,
    seoKeywords: form.seoKeywords || null,
    customSchemaJson: form.customSchemaJson || null,
    ratingValue: form.ratingValue,
    reviewCount: form.reviewCount,
    status: form.status,
    sort: form.sort,
    deliveryType,
    skus,
  };
}
