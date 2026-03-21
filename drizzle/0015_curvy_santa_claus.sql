ALTER TABLE `training_sets` ADD `currentPuzzleIndex` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `training_sets` ADD `currentCycle` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `training_sets` ADD `correctCount` int DEFAULT 0;