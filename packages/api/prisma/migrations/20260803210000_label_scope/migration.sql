-- Tags stop being one shared vocabulary and become two: a routine's and a
-- task's. Renaming "revisar" on a task used to rename it on a routine as well,
-- which is not what either list meant by the word.
--
-- Everything that exists today was created from the routines card, so the
-- column defaults to ROUTINE. The exception is a label a task had already been
-- given: that one is copied into the task pool and the task's link repointed at
-- the copy, so both sides keep exactly what they were showing.

ALTER TABLE "labels" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'ROUTINE';

CREATE INDEX "labels_scope_idx" ON "labels"("scope");

CREATE TEMP TABLE "label_fork" AS
SELECT l."id" AS old_id, gen_random_uuid() AS new_id
FROM "labels" l
WHERE EXISTS (SELECT 1 FROM "task_labels" tl WHERE tl."labelId" = l."id");

INSERT INTO "labels" ("id", "name", "color", "scope", "createdAt")
SELECT f.new_id, l."name", l."color", 'TASK', l."createdAt"
FROM "label_fork" f
JOIN "labels" l ON l."id" = f.old_id;

UPDATE "task_labels" tl
SET "labelId" = f.new_id
FROM "label_fork" f
WHERE tl."labelId" = f.old_id;

DROP TABLE "label_fork";
