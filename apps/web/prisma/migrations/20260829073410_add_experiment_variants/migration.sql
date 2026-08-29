-- Hand-written (not raw `prisma migrate dev` output): the diff between the old two-arm shape
-- (Variant enum on Assignment/Event/Conversion, single Experiment.variantUrl) and the new
-- multi-variant shape can't preserve data as a straight column drop, so this backfills between
-- the schema changes rather than losing the existing rows. See schema.prisma's header comment
-- for what NULL vs. non-null `variantId` means.

-- 1. New table for redirect targets, added before anything references it.
CREATE TABLE "experiment_variants" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

-- 2. One variant row per existing experiment, carrying its old single variantUrl forward as
--    "Variant 1" (position 1).
INSERT INTO "experiment_variants" ("id", "experimentId", "position", "url")
SELECT gen_random_uuid()::text, "id", 1, "variantUrl"
FROM "experiments";

-- 3. Nullable FK columns added alongside the old enum columns, so both exist while backfilling.
ALTER TABLE "assignments" ADD COLUMN "variantId" TEXT;
ALTER TABLE "events" ADD COLUMN "variantId" TEXT;
ALTER TABLE "conversions" ADD COLUMN "variantId" TEXT;

-- 4. Backfill: a 'VARIANT' row points at the experiment's new (only) variant row; a 'CONTROL'
--    row keeps variantId NULL, which is exactly what "control" means in the new shape.
UPDATE "assignments" a
SET "variantId" = ev."id"
FROM "experiment_variants" ev
WHERE ev."experimentId" = a."experimentId" AND a."variant" = 'VARIANT';

UPDATE "events" e
SET "variantId" = ev."id"
FROM "experiment_variants" ev
WHERE ev."experimentId" = e."experimentId" AND e."variant" = 'VARIANT';

UPDATE "conversions" c
SET "variantId" = ev."id"
FROM "experiment_variants" ev
WHERE ev."experimentId" = c."experimentId" AND c."variant" = 'VARIANT';

-- 5. Constraints and indexes on the now-populated columns.
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experimentId_fkey"
    FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "experiment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "experiment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "experiment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "experiment_variants_experimentId_position_idx" ON "experiment_variants"("experimentId", "position");
CREATE INDEX "assignments_experimentId_variantId_idx" ON "assignments"("experimentId", "variantId");
CREATE INDEX "events_experimentId_type_variantId_occurredAt_idx" ON "events"("experimentId", "type", "variantId", "occurredAt");
CREATE INDEX "conversions_experimentId_variantId_idx" ON "conversions"("experimentId", "variantId");

-- 6. Old shape dropped last, once nothing depends on it anymore.
DROP INDEX "assignments_experimentId_variant_idx";
DROP INDEX "conversions_experimentId_variant_idx";
DROP INDEX "events_experimentId_type_variant_occurredAt_idx";

ALTER TABLE "assignments" DROP COLUMN "variant";
ALTER TABLE "events" DROP COLUMN "variant";
ALTER TABLE "conversions" DROP COLUMN "variant";
ALTER TABLE "experiments" DROP COLUMN "variantSplit";
ALTER TABLE "experiments" DROP COLUMN "variantUrl";

DROP TYPE "Variant";
