import { z } from "zod";

import { slugify } from "@/lib/slugify";

import type { onGetProductAdminDetail } from "@/server/catalog/admin.telefunc";

export const deliveryTypes = ["CARD_AUTO", "FIXED_CARD", "MANUAL", "EXPRESS"] as const;
export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

export const productFormSchema = z.object({
  id: z.number().int().positive().optional(),
  categoryId: z.number().int().positive("请选择商品分类"),
  name: z.string().trim().min(1, "商品名称不能为空").max(120, "商品名称不能超过 120 个字符"),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug 只能包含小写英文、数字和连字符"),
  subtitle: z.string().max(300, "副标题不能超过 300 个字符"),
  coverImage: z.string(),
  description: z.string().trim().min(1, "商品详情不能为空"),
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
  return {
    id: form.id,
    categoryId: form.categoryId || null,
    name: form.name,
    slug: form.slug,
    subtitle: form.subtitle,
    coverImage: form.coverImage,
    description: form.description,
    manualDeliveryHint: form.manualDeliveryHint,
    purchaseNote: form.purchaseNote,
    buyerFormJson: form.buyerFormJson || null,
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
