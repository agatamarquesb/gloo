-- CreateEnum
CREATE TYPE "CalendarItemKind" AS ENUM ('EVENT', 'TASK', 'APPOINTMENT');

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "kind" "CalendarItemKind" NOT NULL DEFAULT 'EVENT',
ADD COLUMN     "isDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleTaskId" TEXT,
ADD COLUMN     "googleTaskListId" TEXT;

-- AlterTable
ALTER TABLE "agendas" ADD COLUMN     "googleTaskListId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agendas_accountId_googleTaskListId_key" ON "agendas"("accountId", "googleTaskListId");
