/**
 * Development seed.
 *
 * Creates one user with a website, an active experiment and a small, deterministic set of
 * visitors, assignments, events and conversions — enough to build and eyeball the results
 * dashboard before any real traffic exists.
 *
 * Idempotent: re-running it updates the same records rather than accumulating duplicates, so
 * `npm run db:seed` is safe to repeat.
 *
 *   npm run db:seed --workspace @routely/web
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to apps/web/.env first.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SEED_USER_EMAIL = "dev@routely.local";
const SEED_PUBLIC_SITE_ID = "rt_000000000000000000000000000000ab";

async function main() {
  const user = await db.user.upsert({
    where: { email: SEED_USER_EMAIL },
    create: { email: SEED_USER_EMAIL, name: "Local Developer" },
    update: {},
  });

  const website = await db.website.upsert({
    where: { publicSiteId: SEED_PUBLIC_SITE_ID },
    create: {
      userId: user.id,
      name: "Acme Store",
      domain: "acme.test",
      publicSiteId: SEED_PUBLIC_SITE_ID,
    },
    update: { userId: user.id },
  });

  // Experiments have no natural unique key, so the seed looks one up by name within the
  // website rather than upserting blindly.
  const existing = await db.experiment.findFirst({
    where: { websiteId: website.id, name: "Pricing page redesign" },
    include: { variants: true },
  });

  const experiment =
    existing ??
    (await db.experiment.create({
      data: {
        websiteId: website.id,
        name: "Pricing page redesign",
        description: "Does the rebuilt pricing page convert better than the original?",
        controlUrl: "https://acme.test/pricing",
        conversionUrl: "https://acme.test/checkout/thank-you",
        status: "ACTIVE",
        publishedAt: new Date(),
        variants: { create: [{ position: 1, url: "https://acme.test/pricing-v2" }] },
      },
      include: { variants: true },
    }));

  const variant = experiment.variants[0]!;

  /** Visitors per arm, and how many of each convert. Fixed so metrics are reproducible. */
  const PLAN = [
    { variantId: null as string | null, label: "control", visitors: 40, conversions: 4 },
    { variantId: variant.id, label: "variant", visitors: 40, conversions: 7 },
  ];

  const now = Date.now();
  let created = 0;

  for (const plan of PLAN) {
    for (let index = 0; index < plan.visitors; index += 1) {
      const anonymousId = `seed-${plan.label}-${String(index).padStart(3, "0")}`;
      // Spread visitors over the last 14 days so time-series charts have a shape.
      const seenAt = new Date(now - ((index * 37) % (14 * 24 * 60 * 60 * 1000)));

      const visitorRow = await db.visitor.upsert({
        where: { websiteId_anonymousId: { websiteId: website.id, anonymousId } },
        create: {
          websiteId: website.id,
          anonymousId,
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
        },
        update: { lastSeenAt: seenAt },
      });

      const assignment = await db.assignment.upsert({
        where: {
          experimentId_visitorId: { experimentId: experiment.id, visitorId: visitorRow.id },
        },
        create: {
          experimentId: experiment.id,
          visitorId: visitorRow.id,
          variantId: plan.variantId,
          assignedAt: seenAt,
        },
        update: {},
      });

      const pageUrl = plan.variantId === null ? experiment.controlUrl : variant.url;

      // Events are append-only and carry no natural key, so the seed only writes them for
      // assignments it has just created.
      const alreadySeeded = await db.event.count({ where: { assignmentId: assignment.id } });

      if (alreadySeeded === 0) {
        await db.event.createMany({
          data: [
            {
              websiteId: website.id,
              experimentId: experiment.id,
              visitorId: visitorRow.id,
              assignmentId: assignment.id,
              variantId: plan.variantId,
              type: "assignment",
              url: pageUrl,
              occurredAt: seenAt,
            },
            {
              websiteId: website.id,
              experimentId: experiment.id,
              visitorId: visitorRow.id,
              assignmentId: assignment.id,
              variantId: plan.variantId,
              type: "page_view",
              url: pageUrl,
              occurredAt: seenAt,
            },
            {
              websiteId: website.id,
              experimentId: experiment.id,
              visitorId: visitorRow.id,
              assignmentId: assignment.id,
              variantId: plan.variantId,
              type: "time_on_page",
              url: pageUrl,
              durationMs: 8_000 + ((index * 911) % 45_000),
              occurredAt: new Date(seenAt.getTime() + 30_000),
            },
          ],
        });
        created += 3;
      }

      if (index < plan.conversions) {
        const convertedAt = new Date(seenAt.getTime() + 120_000);

        const inserted = await db.conversion.createMany({
          data: [
            {
              experimentId: experiment.id,
              visitorId: visitorRow.id,
              assignmentId: assignment.id,
              variantId: plan.variantId,
              url: experiment.conversionUrl,
              occurredAt: convertedAt,
            },
          ],
          skipDuplicates: true,
        });

        if (inserted.count === 1) {
          await db.event.create({
            data: {
              websiteId: website.id,
              experimentId: experiment.id,
              visitorId: visitorRow.id,
              assignmentId: assignment.id,
              variantId: plan.variantId,
              type: "conversion",
              url: experiment.conversionUrl,
              occurredAt: convertedAt,
            },
          });
          created += 2;
        }
      }
    }
  }

  console.log(
    `Seeded user ${user.email}, website ${website.publicSiteId}, experiment "${experiment.name}" (${created} new rows).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
