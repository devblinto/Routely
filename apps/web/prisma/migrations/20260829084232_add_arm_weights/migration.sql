-- Per-arm traffic weights, replacing the previously-derived even split.
--
-- Both defaults are 50, which is deliberately the no-op value: every arm carrying the same
-- weight normalises to exactly the even split these rows had before, so existing experiments
-- keep the distribution their collected results were gathered under.
ALTER TABLE "experiments" ADD COLUMN "controlWeight" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "experiment_variants" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 50;
