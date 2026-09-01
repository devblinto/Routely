-- Adds a label for an experiment's conversion goal.
--
-- Nullable and with no backfill on purpose: an existing experiment has no name for its goal,
-- and inventing one here would put a guess in the database. The UI falls back to the
-- experiment's own name while this is NULL, which is what it displayed before the column
-- existed.
ALTER TABLE "experiments" ADD COLUMN "conversionName" TEXT;
