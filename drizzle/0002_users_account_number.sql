-- T13 (D17): konta bez danych osobowych. Usuwa model e-mail/hasło/OAuth i WSZYSTKIE istniejące konta
-- (na produkcji wyłącznie konta testowe ze smoke testu; decyzja użytkownika 2026-09-27).
-- Najpierw dane zależne od `users`, potem stare tabele, na końcu nowa tabela `users`.
DELETE FROM `colonies`;
--> statement-breakpoint
DELETE FROM `maps`;
--> statement-breakpoint
DELETE FROM `user_groups`;
--> statement-breakpoint
DROP TABLE `user_auth_methods`;
--> statement-breakpoint
DROP TABLE `password_resets`;
--> statement-breakpoint
DROP TABLE `email_verifications`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_hash` text NOT NULL,
	`nickname` text,
	`totp_secret` text,
	`totp_enabled` integer DEFAULT false NOT NULL,
	`totp_last_step` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_account_hash_unique` ON `users` (`account_hash`);
