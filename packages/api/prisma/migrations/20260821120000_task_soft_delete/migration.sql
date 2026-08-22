-- Deleting a task is now reversible, exactly as deleting a routine already was:
-- "Deletar" moves it to a trash the Tasks page can list, restore from and empty,
-- and only "Deletar permanentemente" / "Esvaziar lixeira" removes the row.
--
-- Existing tasks are all live, so the column is simply null for them.

ALTER TABLE "tasks" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Every list of live tasks filters on this, and the trash reads the complement.
-- Partial, because the live set is the one that stays large.
CREATE INDEX "tasks_deletedAt_idx" ON "tasks" ("deletedAt") WHERE "deletedAt" IS NOT NULL;
