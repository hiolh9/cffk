-- Optional multi-currency list prices (no forced FX).
-- productSku.price remains the default-currency (MYR) minor amount.
-- regionalPricesJson example: {"SGD":1500,"USD":400,"JPY":500}

ALTER TABLE `productSku` ADD `regionalPricesJson` text;
ALTER TABLE `siteSetting` ADD `defaultCurrency` text DEFAULT 'MYR' NOT NULL;
ALTER TABLE `siteSetting` ADD `enabledCurrenciesJson` text;
ALTER TABLE `order` ADD `currency` text DEFAULT 'MYR' NOT NULL;
