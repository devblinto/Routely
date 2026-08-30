-- The scheme a website is served over.
--
-- `domain` stores a bare hostname, so nothing recorded whether a site is http or https, and
-- every prefilled URL in the UI had to assume https. HTTPS is the default and the correct
-- value for every existing row — local development over http is the exception, and is set
-- explicitly when the website is created or edited.
CREATE TYPE "SiteProtocol" AS ENUM ('HTTPS', 'HTTP');

ALTER TABLE "websites" ADD COLUMN "protocol" "SiteProtocol" NOT NULL DEFAULT 'HTTPS';
