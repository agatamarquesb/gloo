-- A routine can now carry up to five checklists instead of one.
--
-- Renamed rather than dropped and recreated, so existing checklists survive:
-- the single stored object is wrapped into a one-element array in place.

ALTER TABLE "routines" RENAME COLUMN "checklist" TO "checklists";

UPDATE "routines"
SET "checklists" = jsonb_build_array("checklists")
WHERE "checklists" IS NOT NULL
  AND jsonb_typeof("checklists") = 'object';
