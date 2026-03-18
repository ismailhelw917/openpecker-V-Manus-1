CREATE TABLE `promo_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`description` text,
	`benefitType` enum('lifetime_premium','discount') NOT NULL,
	`discountPercent` int,
	`maxUses` int NOT NULL,
	`currentUses` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `promo_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promoCodeId` int NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promo_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_promo_code` ON `promo_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_redemption_promoCodeId` ON `promo_redemptions` (`promoCodeId`);--> statement-breakpoint
CREATE INDEX `idx_redemption_userId` ON `promo_redemptions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_redemption_deviceId` ON `promo_redemptions` (`deviceId`);