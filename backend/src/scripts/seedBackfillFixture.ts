import { prisma } from "../config/prisma";

/**
 * Throwaway fixture for verifying backfillCompanyTargets against a real
 * database. Creates one company per branch the resolver can take.
 *
 * NOT for any shared database — it writes companies called "Backfill case ..."
 * and is only ever pointed at a disposable one.
 */
/**
 * Refuses to run against anything that is not obviously disposable.
 *
 * This script inserts companies, users and facilities. A comment saying "only
 * point this at a throwaway database" is not a control — one wrong shell and
 * it seeds junk into a real one. The database name has to opt in.
 */
const assertDisposableDatabase = () => {
  const url = process.env.DATABASE_URL ?? "";
  const name = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/(_tmp|_test|throwaway)$/.test(name)) {
    throw new Error(
      `Refusing to seed: database "${name}" is not named as disposable. ` +
        `Point DATABASE_URL at a database whose name ends in _tmp, _test or throwaway.`,
    );
  }
};

const mk = async (label: string) => {
  const user = await prisma.user.create({
    data: { name: label, email: `${label.replace(/\W/g, "").toLowerCase()}@example.test`, passwordHash: "x" },
  });
  const company = await prisma.company.create({ data: { name: label, ownerId: user.id, sector: "CEMENT" } });
  const facility = await prisma.facility.create({ data: { name: `${label} plant`, companyId: company.id } });
  return { company, facility };
};

const addIssb = (companyId: string, facilityId: string, baselineYear: number, baseline: number, targetYear: number) =>
  prisma.issbS1S2Report.create({
    data: {
      companyId,
      facilityId,
      reportingPeriod: "FY2025-26",
      baselineYear,
      baselineEmissionsTco2e: baseline,
      targetYear,
      status: "SUBMITTED",
    },
  });

const addCdp = async (
  companyId: string,
  facilityId: string,
  baseYear: number,
  baseline: number,
  targetYear: number,
) => {
  const report = await prisma.cdpReport.create({
    data: { companyId, facilityId, reportingPeriod: "FY2025-26" },
  });
  await prisma.cdpTarget.create({
    data: {
      cdpReportId: report.id,
      kind: "ABSOLUTE",
      scopesCovered: "Scope 1+2 (location-based)",
      baseYear,
      baseYearEmissionsTco2e: baseline,
      targetYear,
      reductionPct: 42,
    },
  });
};

const main = async () => {
  assertDisposableDatabase();

  const a = await mk("Backfill case A issb only");
  await addIssb(a.company.id, a.facility.id, 2020, 1000, 2030);

  const b = await mk("Backfill case B cdp only");
  await addCdp(b.company.id, b.facility.id, 2019, 800, 2032);

  // Both, disagreeing on all three shared fields.
  const c = await mk("Backfill case C conflict");
  await addIssb(c.company.id, c.facility.id, 2020, 1000, 2030);
  await addCdp(c.company.id, c.facility.id, 2018, 900, 2035);

  // Both, agreeing.
  const d = await mk("Backfill case D agree");
  await addIssb(d.company.id, d.facility.id, 2020, 1000, 2030);
  await addCdp(d.company.id, d.facility.id, 2020, 1000, 2030);

  const e = await mk("Backfill case E already has target");
  await addIssb(e.company.id, e.facility.id, 2021, 500, 2040);
  await prisma.companyTarget.create({
    data: {
      companyId: e.company.id,
      scopesCovered: "Scope 1",
      baselineYear: 2015,
      baselineEmissionsTco2e: 123,
      targetYear: 2045,
      status: "SUBMITTED",
    },
  });

  await mk("Backfill case F no source");

  console.log("seeded 6 companies");
  await prisma.$disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
