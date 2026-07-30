-- A task can carry links and files, the same way a routine can — the task rows
-- report how many. Same column shape as `routines.attachments`, so the one
-- parser reads both.
--
-- Null for every existing task, which the DTO reports as a count of zero.

ALTER TABLE "tasks" ADD COLUMN "attachments" JSONB;
