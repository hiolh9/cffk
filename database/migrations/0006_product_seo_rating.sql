-- Optional SEO rating fields for AggregateRating JSON-LD (per product).
-- Only set these when you have real ratings/reviews; do not invent fake stars.
ALTER TABLE `product_v2` ADD COLUMN `ratingValue` text;
ALTER TABLE `product_v2` ADD COLUMN `reviewCount` integer;
