-- One full re-read of every linked calendar, so the label added by the previous
-- migration arrives for the events that already exist.
--
-- Same reasoning as the colour resync before it: Google's incremental sync only
-- reports what has *changed*, so an event whose label we never asked for would
-- keep the new column null — and the dialog would then offer a colour without
-- warning that it destroys something. A warning that is only sometimes right is
-- worse than none.
UPDATE "agendas" SET "googleSyncToken" = NULL WHERE "googleSyncToken" IS NOT NULL;
