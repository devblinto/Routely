-- Rename experiments.startedAt → experiments.publishedAt.
--
-- Hand-written rather than generated: Prisma's diff sees a dropped column and a new one and
-- would recreate it empty, losing the publication timestamp of every running experiment.
-- A RENAME preserves the values.

ALTER TABLE "experiments" RENAME COLUMN "startedAt" TO "publishedAt";
