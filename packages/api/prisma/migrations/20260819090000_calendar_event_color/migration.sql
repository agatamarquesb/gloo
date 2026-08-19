-- An event's own colour, as against its agenda's — Google's "event colour".
-- Null means the agenda's, which is what every existing row means. See
-- CalendarEvent.color.
ALTER TABLE "calendar_events" ADD COLUMN "color" TEXT;
