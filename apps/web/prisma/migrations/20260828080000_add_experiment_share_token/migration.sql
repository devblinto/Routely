-- Public, read-only results sharing.
--
-- Both columns are nullable and added without a default, so this is a metadata-only change:
-- no table rewrite, no lock held while existing rows are updated. Sharing is off for every
-- experiment until someone turns it on.
--
-- The uniqueness of shareToken is what makes the public route safe to look up by token alone.

ALTER TABLE "experiments" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "experiments" ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "experiments_shareToken_key" ON "experiments"("shareToken");
