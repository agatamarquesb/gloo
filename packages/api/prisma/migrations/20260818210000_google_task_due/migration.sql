-- The `due` a task last arrived from Google with, so a sync can tell a date
-- Google changed from one the user set here. See CalendarEvent.googleTaskDue.
ALTER TABLE "calendar_events" ADD COLUMN "googleTaskDue" TIMESTAMP(3);
