-- Records when the tracking snippet was last confirmed present on a page of a website.
--
-- Nullable and without a default, so this is a metadata-only change: no table rewrite and no
-- lock held while existing rows are updated. Every existing website starts unverified, which
-- is accurate — none of them has been checked under this column.

ALTER TABLE "websites" ADD COLUMN "pixelVerifiedAt" TIMESTAMP(3);
