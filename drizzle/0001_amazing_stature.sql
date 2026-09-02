CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`prefix` varchar(24) NOT NULL,
	`keyHash` varchar(128) NOT NULL,
	`hostQuota` int NOT NULL DEFAULT 25,
	`requestsPerMinute` int NOT NULL DEFAULT 30,
	`requestCount` int NOT NULL DEFAULT 0,
	`lastRequestAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_prefix_unique` UNIQUE(`prefix`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`apiKeyId` int,
	`action` varchar(80) NOT NULL,
	`resource` varchar(255),
	`ip` varchar(45),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dns_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`cloudflareRecordId` varchar(64) NOT NULL,
	`recordType` varchar(8) NOT NULL DEFAULT 'A',
	`proxied` int NOT NULL DEFAULT 0,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dns_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `dns_records_hostId_unique` UNIQUE(`hostId`),
	CONSTRAINT `dns_records_cloudflareRecordId_unique` UNIQUE(`cloudflareRecordId`)
);
--> statement-breakpoint
CREATE TABLE `hosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`apiKeyId` int,
	`hostname` varchar(255) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`ttl` int NOT NULL DEFAULT 300,
	`expiresAt` timestamp,
	`status` enum('active','expired','deleted') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hosts_id` PRIMARY KEY(`id`),
	CONSTRAINT `hosts_hostname_unique` UNIQUE(`hostname`)
);
--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `hosts_user_idx` ON `hosts` (`userId`);--> statement-breakpoint
CREATE INDEX `hosts_status_idx` ON `hosts` (`status`);--> statement-breakpoint
CREATE INDEX `hosts_expires_idx` ON `hosts` (`expiresAt`);