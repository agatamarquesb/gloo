-- "Em revisão" is gone: a task is to do, in progress, or done.
--
-- Anything sitting in review is still being worked on, so it moves to
-- IN_PROGRESS rather than to DONE — the alternative would mark work finished
-- that nobody finished.
--
-- Postgres cannot drop a value from an enum in place, hence the swap: rename the
-- old type out of the way, build the new one, recast the column through text,
-- and drop what is left. The default has to come off before the cast and go back
-- on after, because it is typed against the enum being replaced.

UPDATE "tasks" SET "status" = 'IN_PROGRESS' WHERE "status" = 'IN_REVIEW';

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "TaskStatus" USING ("status"::text::"TaskStatus");
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'TODO';

DROP TYPE "TaskStatus_old";
