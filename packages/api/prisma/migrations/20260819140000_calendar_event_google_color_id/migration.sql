-- The colorId an event last arrived from Google with, so a sync can tell a
-- colour Google changed from one the user set here. See
-- CalendarEvent.googleColorId.
--
-- Backfilled from the colour already imported: every non-null `color` on a
-- Google-mirrored row was written by the importer from a colorId, so seeding
-- this to that colorId's hex-free marker would be guesswork. Left null instead —
-- the first sync after this migration adopts Google's answer once and the two
-- agree from then on.
ALTER TABLE "calendar_events" ADD COLUMN "googleColorId" TEXT;
