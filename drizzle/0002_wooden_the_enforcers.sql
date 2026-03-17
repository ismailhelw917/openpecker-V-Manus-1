ALTER TABLE `puzzles` ADD `openingName` varchar(255);--> statement-breakpoint
ALTER TABLE `puzzles` ADD `openingVariation` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_opening` ON `puzzles` (`openingName`);