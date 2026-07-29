-- Routines gain multiple assignees, labels and attachments.
--
-- Hand-ordered rather than left as Prisma generated it: the join table is
-- created and back-filled from the old single `assigneeId` BEFORE that column
-- is dropped, so existing routines keep their assignee.

-- CreateTable
CREATE TABLE "routine_assignees" (
    "routineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "routine_assignees_pkey" PRIMARY KEY ("routineId","userId")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_labels" (
    "routineId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "routine_labels_pkey" PRIMARY KEY ("routineId","labelId")
);

-- AddForeignKey
ALTER TABLE "routine_assignees" ADD CONSTRAINT "routine_assignees_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_assignees" ADD CONSTRAINT "routine_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_labels" ADD CONSTRAINT "routine_labels_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_labels" ADD CONSTRAINT "routine_labels_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Back-fill: every routine's existing assignee becomes its first join row.
INSERT INTO "routine_assignees" ("routineId", "userId")
SELECT "id", "assigneeId" FROM "routines";

-- DropIndex
DROP INDEX "routines_assigneeId_idx";

-- AlterTable
ALTER TABLE "routines" DROP COLUMN "assigneeId",
ADD COLUMN     "attachments" JSONB;
