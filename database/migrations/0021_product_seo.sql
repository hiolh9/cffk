-- Per-product SEO overrides for storefront meta + JSON-LD
ALTER TABLE `product_v2` ADD `seoTitle` text;
ALTER TABLE `product_v2` ADD `seoDescription` text;
ALTER TABLE `product_v2` ADD `seoKeywords` text;
ALTER TABLE `product_v2` ADD `customSchemaJson` text;
