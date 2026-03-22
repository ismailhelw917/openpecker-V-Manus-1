CREATE TABLE `active_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`isGuest` int NOT NULL DEFAULT 1,
	`currentPath` varchar(255),
	`lastActive` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `active_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_activeSessions_userId` ON `active_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_activeSessions_deviceId` ON `active_sessions` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_activeSessions_lastActive` ON `active_sessions` (`lastActive`);