CREATE TABLE `community_events` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `venue` text NOT NULL,
  `zone` text NOT NULL,
  `category` text NOT NULL,
  `event_date` text NOT NULL,
  `event_time` text NOT NULL,
  `price` integer NOT NULL CHECK (`price` >= 0),
  `description` text NOT NULL,
  `lat` real NOT NULL,
  `lng` real NOT NULL,
  `image_data` text NOT NULL DEFAULT '',
  `group_eligible` integer NOT NULL DEFAULT 0,
  `creator_session_hash` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `community_events_date_idx` ON `community_events` (`event_date`, `event_time`);
--> statement-breakpoint
CREATE INDEX `community_events_creator_idx` ON `community_events` (`creator_session_hash`, `created_at`);
--> statement-breakpoint
CREATE TABLE `groups` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `event_title` text NOT NULL,
  `host_name` text NOT NULL,
  `host_session_hash` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `groups_host_idx` ON `groups` (`host_session_hash`, `created_at`);
--> statement-breakpoint
CREATE TABLE `group_members` (
  `group_id` text NOT NULL REFERENCES `groups`(`id`) ON DELETE CASCADE,
  `session_hash` text NOT NULL,
  `name` text NOT NULL,
  `joined_at` text NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (`group_id`, `session_hash`)
);
