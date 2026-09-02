ALTER TABLE `hosts` ADD `managementId` varchar(40) NOT NULL;--> statement-breakpoint
ALTER TABLE `hosts` ADD CONSTRAINT `hosts_managementId_unique` UNIQUE(`managementId`);