CREATE TABLE `stats_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`exportType` enum('full','opening','monthly') NOT NULL DEFAULT 'full',
	`csvUrl` text NOT NULL,
	`recordCount` int NOT NULL,
	`fileSize` int,
	`exportedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `stats_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_opening_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`opening` varchar(255) NOT NULL,
	`variation` varchar(255),
	`totalPuzzles` int NOT NULL DEFAULT 0,
	`correctPuzzles` int NOT NULL DEFAULT 0,
	`accuracy` decimal(5,2) NOT NULL DEFAULT '0',
	`avgTimeMs` int NOT NULL DEFAULT 0,
	`totalTimeMs` int NOT NULL DEFAULT 0,
	`ratingChange` int DEFAULT 0,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_opening_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_se_userId` ON `stats_exports` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_se_deviceId` ON `stats_exports` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_se_exportedAt` ON `stats_exports` (`exportedAt`);--> statement-breakpoint
CREATE INDEX `idx_uos_userId` ON `user_opening_stats` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_uos_deviceId` ON `user_opening_stats` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_uos_opening` ON `user_opening_stats` (`opening`);--> statement-breakpoint
CREATE INDEX `idx_uos_user_opening` ON `user_opening_stats` (`userId`,`opening`);