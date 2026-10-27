-- Per-product custom checkout fields (account IDs, etc.)
ALTER TABLE `product_v2` ADD `buyerFormJson` text;
-- Submitted values snapshot on order (admin + supplier API)
ALTER TABLE `order` ADD `buyerFormValuesJson` text;
