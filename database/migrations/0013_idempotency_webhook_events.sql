CREATE TABLE `orderIdempotency` (
	`keyHash` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`orderNo` text,
	`orderId` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orderIdempotency_userId_idx` ON `orderIdempotency` (`userId`);
--> statement-breakpoint
CREATE INDEX `orderIdempotency_expiresAt_idx` ON `orderIdempotency` (`expiresAt`);
--> statement-breakpoint
CREATE TABLE `paymentWebhookEvent` (
	`eventKey` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`orderNo` text,
	`orderId` integer,
	`paymentStatus` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `paymentWebhookEvent_provider_createdAt_idx` ON `paymentWebhookEvent` (`provider`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `paymentWebhookEvent_orderNo_idx` ON `paymentWebhookEvent` (`orderNo`);
