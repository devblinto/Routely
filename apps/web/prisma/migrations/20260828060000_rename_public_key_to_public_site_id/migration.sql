-- Rename websites.publicKey → websites.publicSiteId.
--
-- Hand-written rather than generated: Prisma's diff sees a dropped column and a new one, and
-- would recreate the column empty, discarding every existing site identifier — which would
-- silently break every already-installed tracking snippet. A RENAME preserves the values.
--
-- The unique index is renamed alongside it so the database matches the name Prisma expects.

ALTER TABLE "websites" RENAME COLUMN "publicKey" TO "publicSiteId";
ALTER INDEX "websites_publicKey_key" RENAME TO "websites_publicSiteId_key";
