import { PrismaClient } from "@prisma/client";
import { SCOPE3_RELEVANCE_BASELINE } from "../src/data/scope3RelevanceBaseline";

const prisma = new PrismaClient();

/**
 * Reference-data seed. Idempotent by design — every write is an upsert on a
 * natural key, so this is safe to run on every deploy and safe to run twice.
 * It must never create or modify tenant data (companies, facilities,
 * emissions entries); reference tables only.
 */
const seedScope3CategoryRelevance = async () => {
  for (const row of SCOPE3_RELEVANCE_BASELINE) {
    await prisma.scope3CategoryRelevance.upsert({
      where: { sector_category: { sector: row.sector, category: row.category } },
      create: row,
      update: { relevance: row.relevance, reasoning: row.reasoning },
    });
  }
  const total = await prisma.scope3CategoryRelevance.count();
  console.log(`Seeded Scope 3 category relevance: ${SCOPE3_RELEVANCE_BASELINE.length} rows upserted, ${total} rows in table.`);
};

const main = async () => {
  await seedScope3CategoryRelevance();
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
