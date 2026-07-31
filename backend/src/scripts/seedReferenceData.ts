import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { SCOPE3_RELEVANCE_BASELINE } from "../data/scope3RelevanceBaseline";

/**
 * Reference-data seed. Lives under src/ (rather than in prisma/seed.ts) so
 * `npm run build` compiles it to dist/ and the production image can run it
 * without tsx — the runner stage prunes devDependencies and never copies
 * src/, so a TypeScript seed entry point would fail there. prisma/seed.ts is
 * a thin wrapper over this same function for local `prisma db seed`.
 *
 * Idempotent by design: every write is an upsert on a natural key, so this is
 * safe to run on every container start and safe to run twice. It must never
 * create or modify tenant data (companies, facilities, emissions entries) —
 * reference tables only.
 */
export const seedReferenceData = async (): Promise<void> => {
  for (const row of SCOPE3_RELEVANCE_BASELINE) {
    await prisma.scope3CategoryRelevance.upsert({
      where: { sector_category: { sector: row.sector, category: row.category } },
      create: row,
      update: { relevance: row.relevance, reasoning: row.reasoning },
    });
  }

  const total = await prisma.scope3CategoryRelevance.count();
  logger.info(
    `[Seed] Scope 3 category relevance: ${SCOPE3_RELEVANCE_BASELINE.length} rows upserted, ${total} rows in table.`,
  );
};

// Run when invoked directly (`node dist/scripts/seedReferenceData.js`), but
// not when imported by prisma/seed.ts.
if (require.main === module) {
  seedReferenceData()
    .catch((error) => {
      logger.error("[Seed] Reference data seed failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
