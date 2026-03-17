CREATE TABLE `cycle_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`trainingSetId` varchar(64) NOT NULL,
	`cycleNumber` int NOT NULL,
	`totalPuzzles` int NOT NULL,
	`correctCount` int NOT NULL,
	`totalTimeMs` int,
	`accuracy` decimal(5,2),
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cycle_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `openings` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`fen` text NOT NULL,
	`ecoCode` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `openings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `puzzle_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`trainingSetId` varchar(64) NOT NULL,
	`cycleNumber` int NOT NULL,
	`puzzleId` varchar(64) NOT NULL,
	`isCorrect` int NOT NULL,
	`timeMs` int,
	`attemptNumber` int DEFAULT 1,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `puzzle_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `puzzles` (
	`id` varchar(64) NOT NULL,
	`fen` text NOT NULL,
	`moves` text NOT NULL,
	`rating` int,
	`themes` text NOT NULL,
	`color` varchar(10),
	`puzzleData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `puzzles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_sets` (
	`id` varchar(64) NOT NULL,
	`userId` int,
	`deviceId` varchar(64),
	`openingName` varchar(255),
	`openingFen` text,
	`themes` text NOT NULL,
	`minRating` int DEFAULT 1000,
	`maxRating` int DEFAULT 2000,
	`puzzleCount` int DEFAULT 20,
	`targetCycles` int DEFAULT 3,
	`colorFilter` varchar(10) DEFAULT 'both',
	`status` enum('active','paused','completed') DEFAULT 'active',
	`cyclesCompleted` int DEFAULT 0,
	`bestAccuracy` decimal(5,2),
	`totalAttempts` int DEFAULT 0,
	`puzzlesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastPlayedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `isPremium` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deviceId` varchar(64);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `cycle_history` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_deviceId` ON `cycle_history` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_trainingSetId` ON `cycle_history` (`trainingSetId`);--> statement-breakpoint
CREATE INDEX `idx_trainingSetId` ON `puzzle_attempts` (`trainingSetId`);--> statement-breakpoint
CREATE INDEX `idx_puzzleId` ON `puzzle_attempts` (`puzzleId`);--> statement-breakpoint
CREATE INDEX `idx_rating` ON `puzzles` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_color` ON `puzzles` (`color`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `training_sets` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_deviceId` ON `training_sets` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `training_sets` (`status`);