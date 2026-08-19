-- One full re-read of every linked calendar, so the colour added by the
-- previous migration arrives for the events that already exist.
--
-- Google's incremental sync only reports what has *changed* since the token was
-- issued, so an event whose colour we simply never asked for before would keep
-- its new column null until somebody happened to edit it over there. Dropping
-- the token costs one wider request per agenda on the next sync and nothing
-- after that.
UPDATE "agendas" SET "googleSyncToken" = NULL WHERE "googleSyncToken" IS NOT NULL;
