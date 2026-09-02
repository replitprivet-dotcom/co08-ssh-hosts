CREATE TABLE `bootstrap_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bootstrap_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `bootstrap_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
