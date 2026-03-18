ALTER TABLE `puzzles` ADD `ecoCode` varchar(10);--> statement-breakpoint
CREATE INDEX `idx_eco` ON `puzzles` (`ecoCode`);