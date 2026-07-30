-- Two things a task gains here, both in service of the task modal.
--
-- 1. "Atrasada" becomes a status you can set, alongside the lateness a passed
--    due date already implies. `ALTER TYPE ... ADD VALUE` would be shorter, but
--    it cannot run inside the transaction Prisma wraps a migration in on older
--    servers — so this uses the same rename-and-recast swap as the migration
--    that dropped IN_REVIEW. The default comes off before the cast and goes back
--    on after, because it is typed against the enum being replaced.
--
-- 2. The clock behind the productivity chart: how long the task has spent in
--    IN_PROGRESS. Existing tasks start at zero with no stretch running, which is
--    what a task nobody has moved since looks like anyway.

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'OVERDUE');

ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "TaskStatus" USING ("status"::text::"TaskStatus");
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'TODO';

DROP TYPE "TaskStatus_old";

ALTER TABLE "tasks" ADD COLUMN "workedMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN "completedAt" TIMESTAMP(3);
