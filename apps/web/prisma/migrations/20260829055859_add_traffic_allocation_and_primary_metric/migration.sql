-- CreateEnum
CREATE TYPE "PrimaryMetric" AS ENUM ('CONVERSION_RATE', 'TIME_ON_PAGE', 'PAGE_VIEWS');

-- AlterTable
ALTER TABLE "experiments" ADD COLUMN     "primaryMetric" "PrimaryMetric" NOT NULL DEFAULT 'CONVERSION_RATE',
ADD COLUMN     "trafficAllocation" INTEGER NOT NULL DEFAULT 100;
