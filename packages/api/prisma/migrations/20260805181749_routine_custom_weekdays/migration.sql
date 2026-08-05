-- AlterTable
ALTER TABLE "routines" ADD COLUMN     "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
