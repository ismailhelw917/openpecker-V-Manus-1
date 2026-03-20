ALTER TABLE `puzzles` ADD `puzzleName` varchar(255);--> statement-breakpoint
ALTER TABLE `puzzles` ADD `subVariation` varchar(255);--> statement-breakpoint
ALTER TABLE `puzzles` ADD `difficulty` int DEFAULT 1500;--> statement-breakpoint
ALTER TABLE `puzzles` ADD `variations` text;--> statement-breakpoint
ALTER TABLE `puzzles` ADD `numAttempts` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `puzzles` ADD `numSolved` int DEFAULT 0;