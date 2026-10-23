-- Hard fingerprint hash on device sightings + FP blacklist support (kind=FP).
ALTER TABLE `riskDeviceSighting` ADD COLUMN `fpHash` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `riskDeviceSighting_fp_idx` ON `riskDeviceSighting` (`fpHash`);
