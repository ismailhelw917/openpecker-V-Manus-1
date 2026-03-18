ALTER TABLE `users` ADD `hasRegistered` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isRegistered`;