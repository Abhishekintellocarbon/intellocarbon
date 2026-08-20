import { prisma } from "../config/prisma";
import { backfillCompanyTargets } from "../services/companyTargetBackfill.service";

/**
 * Backfills CompanyTarget from existing ISSB / CDP target data.
 *
 *   npx tsx src/scripts/backfillCompanyTargets.ts            # dry run
 *   npx tsx src/scripts/backfillCompanyTargets.ts --apply    # writes
 *
 * DRY RUN IS THE DEFAULT and that is deliberate. The whole reason this script
 * reports conflicts instead of resolving them is so a person reads the list
 * before rows are written; defaulting to --apply would make that impossible to
 * do in the right order. Run it once to read the conflicts, then again with
 * --apply once they make sense.
 *
 * Rows are written as DRAFT, so nothing a report currently displays changes
 * until somebody reviews and submits the target — the framework fallbacks read
 * submitted targets only.
 */
const main = async () => {
  const apply = process.argv.includes("--apply");
  const rows = await backfillCompanyTargets(apply);

  const created = rows.filter((r) => r.outcome === "CREATED");
  const skipped = rows.filter((r) => r.outcome === "SKIPPED_HAS_TARGET");
  const none = rows.filter((r) => r.outcome === "NO_SOURCE");
  const conflicted = created.filter((r) => r.conflicts.length > 0);

  console.log(apply ? "APPLYING" : "DRY RUN — nothing written. Re-run with --apply to write.");
  console.log(
    `${rows.length} companies: ${created.length} to backfill, ${skipped.length} already have a target, ${none.length} have no source data.`,
  );

  for (const r of created) {
    console.log(`  + ${r.companyName} (${r.companyId}) from ${r.source} — ${r.reason}`);
  }

  if (conflicted.length > 0) {
    console.log(`\nCONFLICTS — ${conflicted.length} company(ies) where ISSB and CDP disagree.`);
    console.log("ISSB was written. Check each of these against the company's own filings:");
    for (const r of conflicted) {
      for (const c of r.conflicts) {
        console.log(`  ! ${r.companyName}: ${c.field} — ISSB ${c.issb} vs CDP ${c.cdp}`);
      }
    }
  } else {
    console.log("\nNo conflicts between ISSB and CDP.");
  }

  await prisma.$disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
