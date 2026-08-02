-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "byWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
