-- "Show photos in this Telegram group" (founder decision Sun 2026-10-11, ADR-0023). Off by
-- default: the bot posts the branded card. On: the host's phone may send the Flare's photo
-- for the Telegram post only; the server uploads it from memory and keeps nothing.
alter table groups add column telegram_photos boolean not null default false;
