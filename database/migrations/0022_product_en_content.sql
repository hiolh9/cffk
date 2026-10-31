-- English content fields for multi-language SEO /en routes
ALTER TABLE product_v2 ADD COLUMN nameEn text;
ALTER TABLE product_v2 ADD COLUMN subtitleEn text;
ALTER TABLE product_v2 ADD COLUMN descriptionEn text;
ALTER TABLE product_v2 ADD COLUMN seoTitleEn text;
ALTER TABLE product_v2 ADD COLUMN seoDescriptionEn text;
