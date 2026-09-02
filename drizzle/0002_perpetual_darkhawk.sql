ALTER TABLE `hosts` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
CREATE INDEX `hosts_schedule_idx` ON `hosts` (`scheduleCronTaskUid`);