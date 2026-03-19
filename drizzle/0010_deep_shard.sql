CREATE TABLE `online_sessions` (
	`id` varchar(64) NOT NULL,
	`playerId` int NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`sessionId` varchar(64) NOT NULL,
	`status` enum('active','paused','idle') NOT NULL DEFAULT 'active',
	`lastHeartbeat` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`type` enum('registered','anonymous') NOT NULL,
	`isPremium` int NOT NULL DEFAULT 0,
	`totalPuzzles` int NOT NULL DEFAULT 0,
	`totalCorrect` int NOT NULL DEFAULT 0,
	`totalTimeMs` int NOT NULL DEFAULT 0,
	`completedCycles` int NOT NULL DEFAULT 0,
	`accuracy` decimal(5,2) DEFAULT '0',
	`rating` int NOT NULL DEFAULT 1200,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `visitor_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`page` varchar(255) NOT NULL,
	`referrer` varchar(512),
	`userAgent` text,
	`screenSize` varchar(20),
	`language` varchar(10),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_tracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_online_playerId` ON `online_sessions` (`playerId`);--> statement-breakpoint
CREATE INDEX `idx_online_userId` ON `online_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_online_deviceId` ON `online_sessions` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_online_lastHeartbeat` ON `online_sessions` (`lastHeartbeat`);--> statement-breakpoint
CREATE INDEX `idx_online_status` ON `online_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_players_userId` ON `players` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_players_deviceId` ON `players` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_players_type` ON `players` (`type`);--> statement-breakpoint
CREATE INDEX `idx_players_lastActivity` ON `players` (`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `idx_promo_code` ON `promo_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_redemption_promoCodeId` ON `promo_redemptions` (`promoCodeId`);--> statement-breakpoint
CREATE INDEX `idx_redemption_userId` ON `promo_redemptions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_redemption_deviceId` ON `promo_redemptions` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_vt_fingerprint` ON `visitor_tracking` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_vt_timestamp` ON `visitor_tracking` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_vt_page` ON `visitor_tracking` (`page`);