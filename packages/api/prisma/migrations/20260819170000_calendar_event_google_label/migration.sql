-- The Google event label an event carries, so the dialog can warn before a
-- colour destroys it. See CalendarEvent.googleEventLabelId — the id itself is
-- never rendered or sent; only "there is one" reaches the client.
ALTER TABLE "calendar_events" ADD COLUMN "googleEventLabelId" TEXT;
