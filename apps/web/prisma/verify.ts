/**
 * Data-model verification.
 *
 * Exercises the guarantees the schema is supposed to provide — tenant isolation, assignment
 * consistency, conversion idempotency and the dashboard aggregation paths — against a real
 * Postgres instance, then removes everything it created.
 *
 *   npm run db:verify --workspace @routely/web
 *
 * This is a smoke test for the data layer, not a replacement for unit tests; those arrive
 * with the ingestion logic in Part 5.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to apps/web/.env first.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const suffix = `verify-${process.pid}`;

  const [owner, stranger] = await Promise.all([
    db.user.create({ data: { email: `owner-${suffix}@routely.test`, name: "Owner" } }),
    db.user.create({ data: { email: `stranger-${suffix}@routely.test`, name: "Stranger" } }),
  ]);

  const website = await db.website.create({
    data: {
      userId: owner.id,
      name: "Verify Co",
      domain: "verify.test",
      publicSiteId: `rt_${suffix.replace(/-/g, "")}${"0".repeat(24)}`.slice(0, 35),
    },
  });

  const experiment = await db.experiment.create({
    data: {
      websiteId: website.id,
      name: "Verify experiment",
      controlUrl: "https://verify.test/a",
      conversionUrl: "https://verify.test/done",
      status: "ACTIVE",
      variants: { create: [{ position: 1, url: "https://verify.test/b" }] },
    },
    include: { variants: true },
  });
  const variant = experiment.variants[0]!;

  console.log("\nTenant isolation");
  {
    const asOwner = await db.website.findFirst({ where: { id: website.id, userId: owner.id } });
    const asStranger = await db.website.findFirst({
      where: { id: website.id, userId: stranger.id },
    });
    check("owner reads their own website", asOwner !== null);
    check("another user cannot read it by id", asStranger === null);

    const nested = await db.experiment.findFirst({
      where: { id: experiment.id, website: { userId: stranger.id } },
    });
    check("experiment is not reachable through another user's tenant filter", nested === null);
  }

  console.log("\nVisitor identity");
  const visitor = await db.visitor.upsert({
    where: { websiteId_anonymousId: { websiteId: website.id, anonymousId: "anon-1" } },
    create: { websiteId: website.id, anonymousId: "anon-1" },
    update: { lastSeenAt: new Date() },
  });
  {
    const again = await db.visitor.upsert({
      where: { websiteId_anonymousId: { websiteId: website.id, anonymousId: "anon-1" } },
      create: { websiteId: website.id, anonymousId: "anon-1" },
      update: { lastSeenAt: new Date() },
    });
    check("repeated upsert resolves to the same visitor", again.id === visitor.id);

    let duplicateRejected = false;
    try {
      await db.visitor.create({ data: { websiteId: website.id, anonymousId: "anon-1" } });
    } catch {
      duplicateRejected = true;
    }
    check("duplicate (websiteId, anonymousId) is rejected", duplicateRejected);
  }

  console.log("\nAssignment consistency");
  const assignment = await db.assignment.upsert({
    where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: visitor.id } },
    create: { experimentId: experiment.id, visitorId: visitor.id, variantId: null },
    update: {},
  });
  {
    // A client reporting the opposite arm must not be able to flip a stored assignment.
    const reasserted = await db.assignment.upsert({
      where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: visitor.id } },
      create: { experimentId: experiment.id, visitorId: visitor.id, variantId: variant.id },
      update: {},
    });
    check("assignment is stable across repeated reports", reasserted.id === assignment.id);
    check("the stored arm wins over a conflicting report", reasserted.variantId === null);

    const total = await db.assignment.count({
      where: { experimentId: experiment.id, visitorId: visitor.id },
    });
    check("a visitor holds exactly one arm", total === 1, `found ${total}`);
  }

  console.log("\nConversion idempotency");
  {
    const first = await db.conversion.createMany({
      data: [
        {
          experimentId: experiment.id,
          visitorId: visitor.id,
          assignmentId: assignment.id,
          variantId: null,
          url: "https://verify.test/done",
          occurredAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
    const second = await db.conversion.createMany({
      data: [
        {
          experimentId: experiment.id,
          visitorId: visitor.id,
          assignmentId: assignment.id,
          variantId: null,
          url: "https://verify.test/done",
          occurredAt: new Date(),
        },
      ],
      skipDuplicates: true,
    });
    const total = await db.conversion.count({ where: { assignmentId: assignment.id } });

    check("the first conversion is recorded", first.count === 1);
    check("a duplicate beacon is silently ignored", second.count === 0);
    check("exactly one conversion exists for the assignment", total === 1, `found ${total}`);
  }

  console.log("\nAggregation");
  {
    await db.event.createMany({
      data: [
        {
          websiteId: website.id,
          experimentId: experiment.id,
          visitorId: visitor.id,
          assignmentId: assignment.id,
          variantId: null,
          type: "page_view",
          url: "https://verify.test/a",
          occurredAt: new Date(),
        },
        {
          websiteId: website.id,
          experimentId: experiment.id,
          visitorId: visitor.id,
          assignmentId: assignment.id,
          variantId: null,
          type: "time_on_page",
          url: "https://verify.test/a",
          durationMs: 12_000,
          occurredAt: new Date(),
        },
      ],
    });

    const grouped = await db.event.groupBy({
      by: ["variantId", "type"],
      where: { experimentId: experiment.id },
      _count: { _all: true },
      _sum: { durationMs: true },
    });

    const pageViews = grouped.find((r) => r.type === "page_view")?._count._all ?? 0;
    const visibleMs = grouped.find((r) => r.type === "time_on_page")?._sum.durationMs ?? 0;

    check("page views group by arm and type", pageViews === 1, `got ${pageViews}`);
    check("visible time sums per arm", visibleMs === 12_000, `got ${visibleMs}`);

    const assignments = await db.assignment.groupBy({
      by: ["variantId"],
      where: { experimentId: experiment.id },
      _count: { _all: true },
    });
    const conversions = await db.conversion.groupBy({
      by: ["variantId"],
      where: { experimentId: experiment.id },
      _count: { _all: true },
    });

    const visitors = assignments.find((r) => r.variantId === null)?._count._all ?? 0;
    const converted = conversions.find((r) => r.variantId === null)?._count._all ?? 0;
    check(
      "conversion rate is computable from two grouped counts",
      visitors === 1 && converted === 1,
      `${converted}/${visitors}`,
    );
  }

  console.log("\nCascade");
  {
    await db.website.delete({ where: { id: website.id } });

    const [experiments, visitors, assignments, events, conversions] = await Promise.all([
      db.experiment.count({ where: { websiteId: website.id } }),
      db.visitor.count({ where: { websiteId: website.id } }),
      db.assignment.count({ where: { experimentId: experiment.id } }),
      db.event.count({ where: { websiteId: website.id } }),
      db.conversion.count({ where: { experimentId: experiment.id } }),
    ]);

    check(
      "deleting a website removes its whole tree",
      experiments === 0 && visitors === 0 && assignments === 0 && events === 0 && conversions === 0,
      `${experiments}/${visitors}/${assignments}/${events}/${conversions} left`,
    );
  }

  await db.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
