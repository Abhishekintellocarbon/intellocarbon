import { prisma } from "../src/config/prisma";
import { seedReferenceData } from "../src/scripts/seedReferenceData";

/**
 * Entry point for `prisma db seed` / `npm run prisma:seed` in local
 * development, where tsx is available. Production runs the compiled
 * dist/scripts/seedReferenceData.js directly from the Dockerfile CMD — see
 * that file for why the implementation lives under src/ rather than here.
 */
seedReferenceData()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
