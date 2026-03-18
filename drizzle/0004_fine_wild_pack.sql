CREATE TABLE `global_settings` (
	`id` int NOT NULL DEFAULT 1,
	`showGiftPremiumBanner` int NOT NULL DEFAULT 1,
	`giftPremiumMaxUsers` int NOT NULL DEFAULT 100,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `global_settings_id` PRIMARY KEY(`id`)
);
