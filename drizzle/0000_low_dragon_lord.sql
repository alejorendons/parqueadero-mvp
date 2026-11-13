CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movements` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`at` integer NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movement_not_zero" CHECK("movements"."amount" != 0)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`stay_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`paid_at` integer NOT NULL,
	`day` text NOT NULL,
	`total` integer NOT NULL,
	`method` text NOT NULL,
	`tendered` integer NOT NULL,
	`change` integer NOT NULL,
	`actor` text NOT NULL,
	FOREIGN KEY (`stay_id`) REFERENCES `stays`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_method" CHECK("payments"."method" IN ('cash','transfer','card')),
	CONSTRAINT "payment_amount" CHECK("payments"."total" >= 0 AND "payments"."tendered" >= "payments"."total" AND "payments"."change" = "payments"."tendered" - "payments"."total")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_payment_per_stay` ON `payments` (`stay_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_payment_per_quote` ON `payments` (`quote_id`);--> statement-breakpoint
CREATE INDEX `payments_day` ON `payments` (`day`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`stay_id` text NOT NULL,
	`quoted_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`total` integer NOT NULL,
	`blocks` integer NOT NULL,
	FOREIGN KEY (`stay_id`) REFERENCES `stays`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_stay` ON `quotes` (`stay_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`opening` integer NOT NULL,
	`counted` integer,
	`expected` integer,
	`difference` integer,
	`note` text NOT NULL,
	`actor` text NOT NULL,
	`closed_by` text,
	CONSTRAINT "opening_nonnegative" CHECK("shifts"."opening" >= 0),
	CONSTRAINT "counted_nonnegative" CHECK("shifts"."counted" IS NULL OR "shifts"."counted" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_shift` ON `shifts` ((1)) WHERE "shifts"."closed_at" IS NULL;--> statement-breakpoint
CREATE TABLE `stays` (
	`id` text PRIMARY KEY NOT NULL,
	`plate` text NOT NULL,
	`type` text NOT NULL,
	`entry_at` integer NOT NULL,
	`exit_at` integer,
	`rate` text NOT NULL,
	`vehicle_state` text NOT NULL,
	`business` text NOT NULL,
	`actor` text NOT NULL,
	CONSTRAINT "vehicle_type" CHECK("stays"."type" IN ('car','motorcycle')),
	CONSTRAINT "exit_after_entry" CHECK("stays"."exit_at" IS NULL OR "stays"."exit_at" >= "stays"."entry_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_plate` ON `stays` (`plate`) WHERE "stays"."exit_at" IS NULL;--> statement-breakpoint
CREATE INDEX `stays_entry` ON `stays` (`entry_at`);--> statement-breakpoint
CREATE TRIGGER payment_guard BEFORE INSERT ON payments BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shifts WHERE id=NEW.shift_id AND closed_at IS NULL) THEN RAISE(ABORT,'closed_shift') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM stays WHERE id=NEW.stay_id AND exit_at IS NULL) THEN RAISE(ABORT,'inactive_stay') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM quotes WHERE id=NEW.quote_id AND stay_id=NEW.stay_id AND total=NEW.total AND expires_at>=NEW.paid_at AND quoted_at<=NEW.paid_at) THEN RAISE(ABORT,'invalid_quote') END;
END;
--> statement-breakpoint
CREATE TRIGGER movement_guard BEFORE INSERT ON movements BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shifts WHERE id=NEW.shift_id AND closed_at IS NULL) THEN RAISE(ABORT,'closed_shift') END;
  SELECT CASE WHEN NEW.amount + (SELECT opening FROM shifts WHERE id=NEW.shift_id) + COALESCE((SELECT SUM(total) FROM payments WHERE shift_id=NEW.shift_id AND method='cash'),0) + COALESCE((SELECT SUM(amount) FROM movements WHERE shift_id=NEW.shift_id),0) < 0 THEN RAISE(ABORT,'negative_cash') END;
END;
