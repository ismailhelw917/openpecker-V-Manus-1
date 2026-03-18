CREATE TABLE `dailyStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalUsers` int DEFAULT 0,
	`totalSessions` int DEFAULT 0,
	`totalPageViews` int DEFAULT 0,
	`totalEvents` int DEFAULT 0,
	`avgSessionDuration` int DEFAULT 0,
	`bounceRate` decimal(5,2) DEFAULT '0',
	`topPages` text,
	`topEvents` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyStats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`eventName` varchar(255) NOT NULL,
	`eventCategory` varchar(100),
	`eventValue` varchar(255),
	`eventData` text,
	`page` varchar(255),
	`sessionId` varchar(64),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pageViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`page` varchar(255) NOT NULL,
	`referrer` varchar(255),
	`userAgent` text,
	`ipAddress` varchar(45),
	`sessionId` varchar(64),
	`duration` int,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pageViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`startTime` timestamp NOT NULL DEFAULT (now()),
	`endTime` timestamp,
	`duration` int,
	`pageCount` int DEFAULT 0,
	`eventCount` int DEFAULT 0,
	`userAgent` text,
	`ipAddress` varchar(45),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_dailyStats_date` ON `dailyStats` (`date`);--> statement-breakpoint
CREATE INDEX `idx_events_userId` ON `events` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_events_deviceId` ON `events` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_events_eventName` ON `events` (`eventName`);--> statement-breakpoint
CREATE INDEX `idx_events_timestamp` ON `events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_pageViews_userId` ON `pageViews` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_pageViews_deviceId` ON `pageViews` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_pageViews_page` ON `pageViews` (`page`);--> statement-breakpoint
CREATE INDEX `idx_pageViews_timestamp` ON `pageViews` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_sessions_userId` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_sessions_deviceId` ON `sessions` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_sessions_startTime` ON `sessions` (`startTime`);