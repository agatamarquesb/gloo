-- Deleting a routine is now reversible: "Deletar" moves it to a trash the
-- Routines card can list and restore from, and only "Esvaziar lixeira" removes
-- the row for good.
--
-- Existing routines are all live, so the column is simply null for them.

ALTER TABLE "routines" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Every list of live routines filters on this, and the trash reads the
-- complement. Partial, because the live set is the one that stays large.
CREATE INDEX "routines_deletedAt_idx" ON "routines" ("deletedAt") WHERE "deletedAt" IS NOT NULL;
