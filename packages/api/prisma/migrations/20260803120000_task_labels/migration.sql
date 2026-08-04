-- Tasks carry the same labels routines do — one shared pool of tags, a join
-- table per owner. Mirrors "routine_labels" exactly: composite key, both sides
-- cascading, so deleting a task or a label takes its links with it.

CREATE TABLE "task_labels" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "task_labels_pkey" PRIMARY KEY ("taskId","labelId")
);

ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
