/**
 * Sales / investor demonstration accounts.
 *
 * ===========================================================================
 * THIS SCRIPT WRITES TENANT DATA. It is deliberately NOT part of
 * seedReferenceData.ts, which runs on every production container start and
 * documents that it "must never create or modify tenant data". This one is
 * invoked by hand, and refuses to touch a non-local database without an
 * explicit override flag.
 *
 * Every company it creates carries isDemoAccount: true, which excludes it
 * from the Super Admin overview counts and from all revenue reporting (see
 * the Company.isDemoAccount schema note). Names are also prefixed "DEMO -"
 * so a human reading any screen that does not yet know about the flag still
 * sees what it is.
 *
 * WHAT IS REAL AND WHAT IS NOT. Emission factors, the CEA grid factor, EU
 * default SEE values, the Green Steel bands and the CCTS structure are the
 * platform's real reference values — the demo is wired through the same
 * calculation and report engines a customer uses, so what a prospect sees on
 * screen is genuinely computed, not typed in. The *activity* (production
 * volumes, fuel burns, supplier names, narrative disclosures) is invented.
 * No figure here should ever be quoted as a real customer outcome.
 * ===========================================================================
 *
 * Usage:
 *   npx tsx src/scripts/seedDemoAccounts.ts
 *   npx tsx src/scripts/seedDemoAccounts.ts --allow-remote-db   (guard override)
 *
 * Re-running deletes and rebuilds the demo companies. It never touches a row
 * that isn't one of them.
 */
import { randomBytes } from "crypto";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { hashPassword } from "../utils/password";
import { calculateEmissionsForActivityData } from "../services/emissionCalculation.service";
import { generateReport } from "../services/reportGeneration.service";
import type { Prisma, Sector, SubscriptionTier } from "@prisma/client";

/**
 * Password for the four demo logins.
 *
 * NOT a constant in this file any more. These are real accounts on whatever
 * database the seed is pointed at, so a committed password means anyone with
 * repo access can log into them — which is survivable on a local dev database
 * and is not on production.
 *
 * Set DEMO_ACCOUNT_PASSWORD to choose one. Otherwise a random password is
 * generated and printed once, at the end of the run — capture it then, because
 * nothing stores it and a re-seed produces a different one.
 *
 * Must satisfy the platform password policy (auth.validators.ts): 8+ chars with
 * a lowercase letter, an uppercase letter and a digit. The generated form
 * always does; a supplied one is checked below rather than failing later at a
 * login nobody can explain.
 */
const generatePassword = () => {
  // Ambiguous characters left out — this gets read off a terminal and typed
  // into a login form, sometimes by someone who did not run the seed.
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  // Seed one of each required class, then fill, so policy compliance is
  // structural rather than a matter of luck.
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 20) chars.push(pick(all));
  // Fisher-Yates over crypto bytes, so the guaranteed classes aren't always
  // in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

const resolvePassword = (): { password: string; generated: boolean } => {
  const supplied = process.env.DEMO_ACCOUNT_PASSWORD?.trim();
  if (!supplied) return { password: generatePassword(), generated: true };
  const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}$/;
  if (!policy.test(supplied)) {
    throw new Error(
      "DEMO_ACCOUNT_PASSWORD does not meet the platform password policy (8+ characters, with a lowercase letter, an uppercase letter and a digit).",
    );
  }
  return { password: supplied, generated: false };
};

const DEMO_NAME_PREFIX = "DEMO - ";

interface DemoSpec {
  email: string;
  ownerName: string;
  companyName: string;
  sector: Sector;
  tiers: SubscriptionTier[];
  appliesCbam: boolean;
  appliesCcts: boolean;
  cbamFrameworks: ("EU_CBAM" | "UK_CBAM")[];
}

const DEMOS: Record<"ccts" | "cbam" | "combined" | "esg", DemoSpec> = {
  ccts: {
    email: "demo-ccts@intellocarbon.com",
    ownerName: "Demo CCTS Compliance Lead",
    companyName: "Sahyadri Cement Works",
    sector: "CEMENT",
    tiers: ["CCTS_COMPLIANCE"],
    appliesCbam: false,
    appliesCcts: true,
    cbamFrameworks: [],
  },
  cbam: {
    email: "demo-cbam@intellocarbon.com",
    ownerName: "Demo CBAM Export Manager",
    companyName: "Konkan Green Steel",
    sector: "STEEL",
    tiers: ["CBAM_COMPLIANCE"],
    appliesCbam: true,
    appliesCcts: false,
    cbamFrameworks: ["EU_CBAM"],
  },
  combined: {
    email: "demo-combined@intellocarbon.com",
    ownerName: "Demo Group Compliance Head",
    companyName: "Deccan Integrated Steel",
    sector: "STEEL",
    tiers: ["CBAM_PLUS_CCTS"],
    appliesCbam: true,
    appliesCcts: true,
    cbamFrameworks: ["EU_CBAM"],
  },
  esg: {
    // A real, reachable mailbox rather than an @intellocarbon.com address that
    // nobody can open. This is the account used for live ESG walkthroughs, so
    // password resets and any notification it triggers have to actually arrive.
    email: "intellocarbon.demo.esg@gmail.com",
    ownerName: "Demo Head of Sustainability",
    companyName: "Nilgiri Industries",
    sector: "OTHER",
    tiers: ["BRSR_CORE_REPORTING"],
    appliesCbam: false,
    appliesCcts: false,
    cbamFrameworks: [],
  },
};

export const DEMO_EMAILS = Object.values(DEMOS).map((d) => d.email);

/**
 * Addresses a demo account used to be seeded under.
 *
 * The purge matches on address, so renaming one in DEMOS above would otherwise
 * strand the old row: the next run would not recognise it, would not delete it,
 * and would create a second company alongside it. Retiring an address means
 * moving it here, not deleting it.
 */
const LEGACY_DEMO_EMAILS = ["demo-esg@intellocarbon.com"];

// ---------------------------------------------------------------------------
// Deterministic variation.
//
// Math.random() would make every re-seed produce a different trend, so a
// screenshot taken today and one taken next week would disagree for no reason.
// This is a plain LCG seeded per series: same input, same curve, every run.
// ---------------------------------------------------------------------------
const makeJitter = (seed: number) => {
  let state = seed >>> 0;
  return (spreadPct: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    const unit = state / 0xffffffff; // 0..1
    return 1 + (unit * 2 - 1) * (spreadPct / 100);
  };
};

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

/**
 * Smallest structurally valid PDF, used as the bytes of every demo evidence
 * document. The evidence gate cares that a document exists and has been
 * cross-checked, not what is inside it — and shipping a realistic-looking fake
 * utility bill would be worse than an obviously empty placeholder, since a
 * demo file can end up screenshotted or forwarded.
 */
const EVIDENCE_PLACEHOLDER_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

/**
 * Months of activity history per facility. Two years: the reporting year the
 * demo talks about, plus the prior year the Year-over-Year card compares
 * against. See monthlyPeriods.
 */
const MONTHS_OF_HISTORY = 24;

/** Cement kiln thermal demand, GJ per tonne of clinker — mid-range for an Indian dry-process kiln. */
const KILN_GJ_PER_T_CLINKER = 3.1;
/** Implied by the library's own coal factor: 2.441 tCO2/t at the IPCC 94.6 tCO2/TJ default. */
const COAL_NCV_GJ_PER_T = 25.8;

/**
 * Start of the calendar quarter `anchor` falls in.
 *
 * Trend charts bucket by quarter. Ending the series mid-quarter puts a
 * one-month bucket next to twelve full ones, which renders as emissions
 * collapsing to near zero at the right-hand edge — the demo then looks like a
 * plant that shut down rather than one with a partial quarter. Ending on a
 * quarter boundary removes the artifact entirely.
 */
const quarterStart = (anchor: Date) =>
  new Date(Date.UTC(anchor.getUTCFullYear(), Math.floor(anchor.getUTCMonth() / 3) * 3, 1));

/**
 * `count` complete months ending the month before `anchor`.
 *
 * Called with 24 months rather than 12. The reporting year on show is still
 * twelve months; the preceding twelve exist because the Year-over-Year card
 * needs data spanning two calendar years and otherwise renders its "not enough
 * data yet" empty state on an otherwise fully populated dashboard.
 */
const monthlyPeriods = (anchor: Date, count: number) => {
  const periods: { start: Date; end: Date; label: string }[] = [];
  for (let i = count; i >= 1; i--) {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    periods.push({ start, end, label });
  }
  return periods;
};

/** The FY immediately before the given "FY2025-26" label. */
const previousFy = (fy: string) => {
  const start = Number(fy.replace(/^FY/, "").slice(0, 4)) - 1;
  return `FY${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

/**
 * The last FY that has actually ended. Framework disclosures (BRSR Core, GRI,
 * ISSB) are filed for a completed year, and reportGeneration.service resolves
 * the period the same way — so a disclosure stamped with the *current* FY is
 * invisible to the generator and the demo shows a framework it cannot report
 * on. The 12 months of activity data straddle two FYs, which is exactly why
 * this can't be derived from the last activity month.
 */
const lastCompletedFy = (d: Date) => {
  const y = d.getUTCFullYear();
  const fyStart = d.getUTCMonth() + 1 >= 4 ? y - 1 : y - 2;
  return `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------
const purgeExistingDemos = async () => {
  const purgeEmails = [...DEMO_EMAILS, ...LEGACY_DEMO_EMAILS];
  const existing = await prisma.company.findMany({
    where: { isDemoAccount: true, owner: { email: { in: purgeEmails } } },
    select: { id: true, name: true },
  });
  for (const c of existing) {
    await prisma.company.delete({ where: { id: c.id } });
    logger.info(`[DemoSeed] Removed existing ${c.name}`);
  }
  // Owners are deleted explicitly rather than via the User -> Company cascade,
  // which runs the other way round anyway (see the schema note on that FK).
  const { count } = await prisma.user.deleteMany({ where: { email: { in: purgeEmails } } });
  if (count) logger.info(`[DemoSeed] Removed ${count} existing demo owner(s)`);
};

// ---------------------------------------------------------------------------
// Company + facility scaffolding
// ---------------------------------------------------------------------------
const createDemoCompany = async (spec: DemoSpec, password: string, extra: Partial<Prisma.CompanyUncheckedCreateInput> = {}) => {
  const owner = await prisma.user.create({
    data: {
      name: spec.ownerName,
      email: spec.email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      approvalStatus: "APPROVED",
      active: true,
      emailVerified: true,
      companyName: DEMO_NAME_PREFIX + spec.companyName,
    },
  });

  const company = await prisma.company.create({
    data: {
      ownerId: owner.id,
      name: DEMO_NAME_PREFIX + spec.companyName,
      sector: spec.sector,
      isDemoAccount: true,
      appliesCbam: spec.appliesCbam,
      appliesCcts: spec.appliesCcts,
      cbamFrameworks: spec.cbamFrameworks,
      country: "India",
      reportingFyStartMonth: 4,
      onboardingCompletedAt: new Date(),
      ...extra,
    },
  });

  // Subscriptions are written directly rather than through
  // billing.service.activateSubscriptionForTier, which fires a real
  // "subscription activated" email at the owner address on every call. A seed
  // must not send mail.
  for (const tier of spec.tiers) {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        tier,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        facilitiesIncluded: 2,
      },
    });
  }

  return { owner, company };
};

// ---------------------------------------------------------------------------
// Activity data
//
// One SUBMITTED entry per month, run through the real calculation engine
// (calculateEmissionsForActivityData) rather than having its results typed in.
// That is what keeps the demo internally consistent: the intensity on the
// dashboard, the SEE in the CBAM report and the GEI in the CCTS report are all
// derived from these same rows by the same code a customer's data goes
// through.
// ---------------------------------------------------------------------------
interface MonthlyInputs {
  productionQuantityT: number;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
  fuels: { fuelType: string; quantity: number; unit: string }[];
  processMaterials?: { materialType: string; quantityTonnes: number }[];
  precursors?: { materialType: string; quantityTonnes: number; sourceLabel?: string }[];
  water?: { sourceType: string; withdrawnM3: number; dischargedM3: number }[];
  extra?: Partial<Prisma.ActivityDataUncheckedCreateInput>;
}

const createMonthlyActivity = async (
  facilityId: string,
  companyId: string,
  sector: Sector,
  productCategory: string,
  period: { start: Date; end: Date; label: string },
  inputs: MonthlyInputs,
) => {
  const periodLabel = period.label;
  const entry = await prisma.activityData.create({
    data: {
      facilityId,
      sector,
      periodStart: period.start,
      periodEnd: period.end,
      productCategory,
      productionQuantityT: round(inputs.productionQuantityT),
      gridElectricityMwh: round(inputs.gridElectricityMwh),
      renewableElectricityMwh: round(inputs.renewableElectricityMwh),
      status: "SUBMITTED",
      ...inputs.extra,
      fuelEntries: {
        create: inputs.fuels.map((f) => ({
          fuelType: f.fuelType,
          quantity: round(f.quantity),
          unit: f.unit,
        })),
      },
      processMaterialEntries: inputs.processMaterials
        ? { create: inputs.processMaterials.map((m) => ({ materialType: m.materialType, quantityTonnes: round(m.quantityTonnes) })) }
        : undefined,
      precursorEntries: inputs.precursors
        ? {
            create: inputs.precursors.map((p) => ({
              materialType: p.materialType,
              quantityTonnes: round(p.quantityTonnes),
              sourceLabel: p.sourceLabel,
            })),
          }
        : undefined,
      waterEntries: inputs.water
        ? {
            create: inputs.water.map((w) => ({
              sourceType: w.sourceType,
              withdrawnM3: round(w.withdrawnM3),
              dischargedM3: round(w.dischargedM3),
            })),
          }
        : undefined,
    },
  });

  await calculateEmissionsForActivityData(entry.id);

  // Attach cross-checked supporting evidence.
  //
  // Not decoration: reportGeneration.service refuses to generate while any
  // SUBMITTED entry has no SUPPORTING_EVIDENCE document (EVIDENCE_PENDING), and
  // again while any such document lacks a MATCHED cross-check review
  // (EVIDENCE_NOT_CROSS_CHECKED). A demo without these two rows per month
  // cannot produce a single report, and the dashboard would show every month
  // flagged as evidence pending.
  const document = await prisma.document.create({
    data: {
      facilityId,
      companyId,
      activityDataId: entry.id,
      documentType: "SUPPORTING_EVIDENCE",
      reportingPeriod: periodLabel,
      verified: true,
      fileName: `energy-and-production-returns-${periodLabel}.pdf`,
      fileData: EVIDENCE_PLACEHOLDER_PDF,
    },
  });
  await prisma.crossCheckReview.create({
    data: {
      activityDataId: entry.id,
      documentId: document.id,
      status: "MATCHED",
      notes: "Demonstration evidence — figures reconciled to the monthly returns.",
      reviewedAt: new Date(period.end.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
  });

  return entry;
};

/**
 * Reports what the seed actually produced, straight from the calculation
 * engine's own stored output. Printed rather than asserted: these are the
 * numbers a prospect will be shown, so they are worth reading once after any
 * change to the input assumptions above.
 */
const reportIntensity = async (label: string, facilityId: string) => {
  const results = await prisma.emissionCalculationResult.findMany({
    where: { activityData: { facilityId } },
    select: { ghgIntensityCcts: true, specificEmbeddedEmissionsCbam: true },
  });
  if (results.length === 0) {
    logger.info(`[DemoSeed] ${label}: no calculation results`);
    return { gei: 0, see: 0 };
  }
  const mean = (pick: (r: (typeof results)[number]) => number) =>
    results.reduce((sum, r) => sum + pick(r), 0) / results.length;
  const gei = mean((r) => r.ghgIntensityCcts);
  const see = mean((r) => r.specificEmbeddedEmissionsCbam);
  logger.info(
    `[DemoSeed] ${label}: ${results.length} months | mean CCTS GEI ${gei.toFixed(3)} tCO2e/t | mean CBAM SEE ${see.toFixed(3)} tCO2e/t`,
  );
  return { gei, see };
};

// ---------------------------------------------------------------------------
// 1. CCTS Compliance demo — cement plant against a notified GEI target
// ---------------------------------------------------------------------------
const seedCctsDemo = async (anchor: Date, password: string) => {
  const spec = DEMOS.ccts;
  const { company } = await createDemoCompany(spec, password, {
    subSector: "Grey cement (OPC/PPC)",
    city: "Satara",
    state: "Maharashtra",
    annualTurnoverInr: 8_640_000_000,
    employeeCount: 615,
    isPatDesignatedConsumer: true,
  });

  const facility = await prisma.facility.create({
    data: {
      companyId: company.id,
      name: "Satara Integrated Cement Plant",
      facilityType: "CEMENT_PLANT",
      productionRoute: "CLINKER_PRODUCTION",
      state: "Maharashtra",
      district: "Satara",
      installedCapacityTpa: 1_150_000,
      commissioningYear: 2011,
      productsManufactured: ["OPC 43 Grade", "PPC", "Clinker"],
      isDraft: false,
    },
  });

  // The notified intensity target the trend is judged against. The plant
  // starts above it and ends below it, which is what gives the demo a CCC
  // deficit early in the year and a surplus late — a flat pass would show
  // nothing about how the module behaves.
  // Set at the median of the computed series (0.665 -> 0.549), so the plant
  // runs a CCC deficit through the first year and a surplus through the second
  // as the clinker factor and thermal substitution rate improve. A target the
  // plant clears every month would demonstrate nothing about how the CCC
  // position behaves.
  const TARGET_GEI = 0.605;
  const jitter = makeJitter(1101);
  const periods = monthlyPeriods(quarterStart(anchor), MONTHS_OF_HISTORY);

  for (const [i, period] of periods.entries()) {
    // Trends are expressed against progress through the series rather than as
    // a fixed step per month, so changing MONTHS_OF_HISTORY rescales the curve
    // instead of running it off the end into implausible values.
    const progress = i / (periods.length - 1);
    // Clinker factor falls through the period as blended-cement share rises —
    // the single biggest real lever on cement GEI, so the improvement the
    // chart shows has a cause a cement engineer would recognise.
    const clinkerFactor = 0.755 - progress * 0.092;
    const tsr = 0.04 + progress * 0.22;
    const production = 86_000 * jitter(4);
    const clinker = production * clinkerFactor;

    await createMonthlyActivity(facility.id, company.id, "CEMENT", "PPC / OPC 43 Grade", period, {
      productionQuantityT: production,
      gridElectricityMwh: production * 0.0763 * jitter(2),
      // Rooftop + open-access solar commissioned mid-year, ramping after month 5.
      renewableElectricityMwh: production * (progress < 0.42 ? 0.0021 : 0.0119) * jitter(3),
      fuels: [
        // Kiln thermal demand is ~3.1 GJ/t clinker, split between coal and
        // alternative fuels by the thermal substitution rate. TSR climbs from
        // 4% to ~15% across the year, so coal falls as RDF rises rather than
        // the two moving independently — a split that didn't conserve total
        // thermal energy would show up immediately to anyone who checks.
        { fuelType: "PCI_COAL", quantity: (clinker * KILN_GJ_PER_T_CLINKER * (1 - tsr)) / COAL_NCV_GJ_PER_T * jitter(3), unit: "TONNE" },
        { fuelType: "ALTERNATIVE_FUELS", quantity: clinker * KILN_GJ_PER_T_CLINKER * tsr * jitter(4), unit: "GJ" },
      ],
      processMaterials: [
        { materialType: "FLY_ASH", quantityTonnes: production * (1 - clinkerFactor) * 0.68 },
        { materialType: "GYPSUM", quantityTonnes: production * 0.041 },
      ],
      water: [
        { sourceType: "GROUNDWATER", withdrawnM3: production * 0.118 * jitter(5), dischargedM3: production * 0.031 * jitter(6) },
        { sourceType: "RECYCLED", withdrawnM3: production * 0.048 * jitter(7), dischargedM3: 0 },
      ],
      extra: {
        limestoneInputTonnes: round(clinker * 1.546 * jitter(2)),
        clinkerProducedTonnes: round(clinker),
        clinkerConversionFraction: round(clinkerFactor, 4),
        cctsTargetIntensity: TARGET_GEI,
        notes: i === 0 ? "Baseline month for the series. Kiln 2 refractory campaign completed." : undefined,
      },
    });
  }

  const { gei } = await reportIntensity("CCTS demo (cement)", facility.id);
  return { company, facility, gei, targetGei: TARGET_GEI, periods };
};

// ---------------------------------------------------------------------------
// 2. CBAM Compliance demo — DRI-EAF steel exporter to the EU
//
// Tuned to land below the EU default SEE for its route (DRI_EAF, 1.35
// tCO2e/t) so the "actual beats default" case the module exists to make is
// actually visible, and below 1.6 so the Green Steel Taxonomy card shows a
// five-star band. Both thresholds are the platform's real reference values;
// only the plant's throughput and fuel mix are invented.
// ---------------------------------------------------------------------------
const seedCbamDemo = async (anchor: Date, password: string) => {
  const spec = DEMOS.cbam;
  const { company } = await createDemoCompany(spec, password, {
    subSector: "Flat and long steel products",
    city: "Ratnagiri",
    state: "Maharashtra",
    annualTurnoverInr: 24_800_000_000,
    employeeCount: 1_240,
    euImporterName: "Adriatic Steel Trading BV",
    euImporterEori: "NL824571903",
    euImporterCountry: "Netherlands",
    euImporterContactEmail: "cbam@demo-adriatic-steel.invalid",
  });

  const facility = await prisma.facility.create({
    data: {
      companyId: company.id,
      name: "Ratnagiri DRI-EAF Works",
      facilityType: "EAF_MINI_MILL",
      productionRoute: "DRI_EAF",
      state: "Maharashtra",
      district: "Ratnagiri",
      installedCapacityTpa: 620_000,
      commissioningYear: 2018,
      productsManufactured: ["Hot-rolled coil", "Rebar"],
      cnCodes: ["72083990", "72142000"],
      isDraft: false,
    },
  });

  const jitter = makeJitter(2202);
  const periods = monthlyPeriods(quarterStart(anchor), MONTHS_OF_HISTORY);

  for (const [i, period] of periods.entries()) {
    const progress = i / (periods.length - 1);
    const production = 43_500 * jitter(5);
    // Scrap share rises through the period, displacing gas-route DRI — the
    // dominant lever on a DRI-EAF plant's intensity.
    const scrapShare = 0.14 + progress * 0.10;
    const driShare = 1.04 - scrapShare;
    // Renewable PPA lands a third of the way in and grows; the EAF's
    // electricity is the second-largest contributor, so this bends the trend.
    const renewableShare = progress < 0.33 ? 0.05 : Math.min(0.22, 0.08 + (progress - 0.3) * 0.2);
    const totalElectricity = production * 0.615 * jitter(2);

    await createMonthlyActivity(facility.id, company.id, "STEEL", "Hot-rolled coil", period, {
      productionQuantityT: production,
      gridElectricityMwh: totalElectricity * (1 - renewableShare),
      renewableElectricityMwh: totalElectricity * renewableShare,
      fuels: [
        // 10.6 GJ/t DRI at the library's 48 GJ per '000 Nm3 NCV.
        { fuelType: "NATURAL_GAS", quantity: (production * driShare * 10.6) / 48 * jitter(3), unit: "THOUSAND_NM3" },
        { fuelType: "HSD_DIESEL", quantity: production * 0.00042 * jitter(8), unit: "KILOLITRE" },
      ],
      processMaterials: [{ materialType: "LIMESTONE", quantityTonnes: production * 0.032 * jitter(4) }],
      precursors: [
        { materialType: "SCRAP", quantityTonnes: production * scrapShare, sourceLabel: "Domestic shredded scrap (demo)" },
        { materialType: "FERRO_ALLOY", quantityTonnes: production * 0.011, sourceLabel: "Ferro-alloy supplier (demo)" },
      ],
      water: [
        { sourceType: "SURFACE_WATER", withdrawnM3: production * 1.42 * jitter(5), dischargedM3: production * 0.55 * jitter(6) },
        { sourceType: "RECYCLED", withdrawnM3: production * 3.1 * jitter(4), dischargedM3: 0 },
      ],
      extra: {
        notes: i === Math.round(periods.length * 0.33) ? "Renewable PPA commissioned — 22 MW open-access solar." : undefined,
      },
    });
  }

  const { see } = await reportIntensity("CBAM demo (DRI-EAF steel)", facility.id);

  // Green Steel Taxonomy assessment. Written from the same aggregate the
  // dashboard card reads, so the stored snapshot and the live figure agree.
  const agg = await prisma.emissionCalculationResult.findMany({
    where: { activityData: { facilityId: facility.id } },
    select: { breakdown: true, activityData: { select: { productionQuantityT: true } } },
  });
  const totalProduction = agg.reduce((sum, r) => sum + (r.activityData.productionQuantityT ?? 0), 0);
  const totalEmissions = see * totalProduction;
  const stars = see < 1.6 ? 5 : see < 2.0 ? 4 : see < 2.2 ? 3 : null;

  await prisma.greenSteelAssessment.create({
    data: {
      companyId: company.id,
      facilityId: facility.id,
      reportingPeriod: lastCompletedFy(anchor),
      totalEmissionsTco2e: round(totalEmissions),
      productionTonnes: round(totalProduction),
      emissionIntensity: round(see, 3),
      starRating: stars,
      qualifiesAsGreen: see < 2.2,
      activityDataCount: agg.length,
    },
  });

  return { company, facility, see, periods };
};

// ---------------------------------------------------------------------------
// 3. Combined CBAM + CCTS demo — BF-BOF integrated plant obligated under both
//
// BF-BOF sits above the EU default (2.05), which is the honest position for
// the route and makes the Article 9 deduction the interesting number rather
// than a headline saving. carbonPricePaidEurPerTonne is what drives that
// deduction.
// ---------------------------------------------------------------------------
const seedCombinedDemo = async (anchor: Date, password: string) => {
  const spec = DEMOS.combined;
  const { company } = await createDemoCompany(spec, password, {
    subSector: "Integrated flat steel",
    city: "Bellary",
    state: "Karnataka",
    annualTurnoverInr: 61_500_000_000,
    employeeCount: 3_980,
    isPatDesignatedConsumer: true,
    euImporterName: "Rhein Metall Handel GmbH",
    euImporterEori: "DE517824663",
    euImporterCountry: "Germany",
    euImporterContactEmail: "cbam@demo-rheinmetall-handel.invalid",
  });

  const facility = await prisma.facility.create({
    data: {
      companyId: company.id,
      name: "Bellary Integrated Steel Plant",
      facilityType: "INTEGRATED_STEEL_PLANT",
      productionRoute: "BF_BOF",
      state: "Karnataka",
      district: "Bellary",
      installedCapacityTpa: 2_400_000,
      commissioningYear: 2006,
      productsManufactured: ["Hot-rolled coil", "Plate", "Slab"],
      cnCodes: ["72081000", "72085100"],
      isDraft: false,
    },
  });

  // Notified CCTS target for the integrated route, and the carbon price the
  // plant can evidence having paid in India — the Article 9 input.
  //
  // Set at the middle of the computed series (2.071-2.133) rather than
  // comfortably above it. A BF-BOF plant sitting right on its notified target
  // and crossing month to month is the realistic position for the route, and
  // it gives the CCC ledger both surplus and deficit months to show.
  const TARGET_GEI = 2.1;
  const CARBON_PRICE_EUR = 8.4;

  const jitter = makeJitter(3303);
  const periods = monthlyPeriods(quarterStart(anchor), MONTHS_OF_HISTORY);

  for (const [i, period] of periods.entries()) {
    const progress = i / (periods.length - 1);
    const production = 172_000 * jitter(4);
    // PCI injection rate rises, displacing coke — the classic BF efficiency lever.
    const cokeRate = 0.478 - progress * 0.066;
    const pciRate = 0.182 + progress * 0.059;
    const renewableShare = progress < 0.5 ? 0.03 : 0.03 + (progress - 0.5) * 0.31;
    const totalElectricity = production * 0.155 * jitter(2);

    await createMonthlyActivity(facility.id, company.id, "STEEL", "Hot-rolled coil", period, {
      productionQuantityT: production,
      gridElectricityMwh: totalElectricity * (1 - renewableShare),
      renewableElectricityMwh: totalElectricity * renewableShare,
      fuels: [
        { fuelType: "METALLURGICAL_COKE", quantity: production * cokeRate * jitter(2), unit: "TONNE" },
        { fuelType: "PCI_COAL", quantity: production * pciRate * jitter(3), unit: "TONNE" },
        { fuelType: "NATURAL_GAS", quantity: (production * 0.42) / 48 * jitter(4), unit: "THOUSAND_NM3" },
      ],
      processMaterials: [
        { materialType: "LIMESTONE", quantityTonnes: production * 0.156 * jitter(3) },
        { materialType: "DOLOMITE", quantityTonnes: production * 0.050 * jitter(4) },
      ],
      water: [
        { sourceType: "SURFACE_WATER", withdrawnM3: production * 2.65 * jitter(4), dischargedM3: production * 0.92 * jitter(5) },
        { sourceType: "RECYCLED", withdrawnM3: production * 8.4 * jitter(3), dischargedM3: 0 },
      ],
      extra: {
        cctsTargetIntensity: TARGET_GEI,
        carbonPricePaidEurPerTonne: CARBON_PRICE_EUR,
        notes: i === Math.round(periods.length * 0.6) ? "Top gas recovery turbine returned to service after overhaul." : undefined,
      },
    });
  }

  const { gei, see } = await reportIntensity("Combined demo (BF-BOF steel)", facility.id);
  return { company, facility, gei, see, targetGei: TARGET_GEI, periods };
};

// ---------------------------------------------------------------------------
// 4. ESG Disclosure Bundle demo — diversified manufacturer
//
// Populates what the ESG surfaces actually read: the /esg/overview rollup, the
// Phase 2 energy / water / waste widgets, the Supplier ESG Scorecard, and one
// SUBMITTED report per framework. Every framework rollup filters on
// status: "SUBMITTED" (see esgOverview.service.ts), so a DRAFT here would show
// as an empty dashboard — which is the exact failure this demo exists to avoid.
// ---------------------------------------------------------------------------
const seedEsgDemo = async (anchor: Date, password: string) => {
  const spec = DEMOS.esg;
  const { company } = await createDemoCompany(spec, password, {
    subSector: "Diversified industrial manufacturing",
    city: "Coimbatore",
    state: "Tamil Nadu",
    annualTurnoverInr: 18_400_000_000,
    employeeCount: 2_150,
    ownershipModel: "MIXED",
    businessModel: "MANUFACTURER",
  });

  const facilities = await Promise.all(
    [
      { name: "Coimbatore Components Works", district: "Coimbatore", capacity: 84_000, products: ["Precision castings", "Machined assemblies"] },
      { name: "Hosur Electricals Unit", district: "Krishnagiri", capacity: 46_000, products: ["Switchgear", "Transformer cores"] },
    ].map((f) =>
      prisma.facility.create({
        data: {
          companyId: company.id,
          name: f.name,
          facilityType: "OTHER",
          productionRoute: "OTHER",
          state: "Tamil Nadu",
          district: f.district,
          installedCapacityTpa: f.capacity,
          commissioningYear: 2013,
          productsManufactured: f.products,
          isDraft: false,
        },
      }),
    ),
  );

  const periods = monthlyPeriods(quarterStart(anchor), MONTHS_OF_HISTORY);
  const fy = lastCompletedFy(anchor);

  for (const [fi, facility] of facilities.entries()) {
    const jitter = makeJitter(4404 + fi * 17);
    const base = fi === 0 ? 6_900 : 3_700;
    for (const [i, period] of periods.entries()) {
      const production = base * jitter(6);
      const renewableShare = 0.12 + (i / (periods.length - 1)) * 0.24;
      const totalElectricity = production * 0.42 * jitter(3);
      await createMonthlyActivity(facility.id, company.id, "OTHER", fi === 0 ? "Precision castings" : "Switchgear", period, {
        productionQuantityT: production,
        gridElectricityMwh: totalElectricity * (1 - renewableShare),
        renewableElectricityMwh: totalElectricity * renewableShare,
        fuels: [
          { fuelType: "NATURAL_GAS", quantity: (production * 1.9) / 48 * jitter(4), unit: "THOUSAND_NM3" },
          { fuelType: "HSD_DIESEL", quantity: production * 0.0012 * jitter(9), unit: "KILOLITRE" },
        ],
        water: [
          { sourceType: "MUNICIPAL", withdrawnM3: production * 0.62 * jitter(5), dischargedM3: production * 0.21 * jitter(6) },
          { sourceType: "GROUNDWATER", withdrawnM3: production * 0.24 * jitter(7), dischargedM3: production * 0.05 * jitter(8) },
          { sourceType: "RECYCLED", withdrawnM3: production * 0.35 * jitter(6), dischargedM3: 0 },
        ],
      });
    }
  }

  await reportIntensity("ESG demo (diversified manufacturing)", facilities[0].id);

  const annualProduction = 12 * (6_900 + 3_700);

  // --- BRSR Core, one per facility, for two years --------------------------
  // Two periods rather than one: the water-balance, waste and safety cards on
  // /esg/overview are *trend* cards. With a single disclosure they render
  // "Not enough data yet" even though the disclosure itself is complete.
  // The prior year is set slightly worse across the board so the trend has a
  // direction rather than being flat.
  const priorFy = previousFy(fy);
  for (const [fi, facility] of facilities.entries()) {
    const scale = fi === 0 ? 0.65 : 0.35;
    await prisma.brsrCoreReport.create({
      data: {
        companyId: company.id,
        facilityId: facility.id,
        reportingPeriod: priorFy,
        status: "SUBMITTED",
        turnoverInr: round(16_900_000_000 * scale),
        waterWithdrawnKl: round(annualProduction * 1.34 * scale),
        waterDischargedKl: round(annualProduction * 0.31 * scale),
        wasteGeneratedTonnes: round(annualProduction * 0.047 * scale),
        wasteRecoveredTonnes: round(annualProduction * 0.034 * scale),
        renewableEnergyConsumptionGj: round(annualProduction * 0.42 * 0.11 * 3.6 * scale),
        nonRenewableEnergyConsumptionGj: round(annualProduction * 0.42 * 0.89 * 3.6 * scale),
        employeeCountTotal: Math.round(2_040 * scale),
        employeeCountFemale: Math.round(2_040 * scale * 0.244),
        wagesPaidMaleInr: round(1_531_000_000 * scale),
        wagesPaidFemaleInr: round(478_000_000 * scale),
        safetyIncidentsCount: fi === 0 ? 5 : 2,
        womenInWorkforcePct: 24.4,
        womenInManagementPct: 15.9,
        procurementFromMsmePct: 31.2,
        consumerComplaintsCount: fi === 0 ? 58 : 23,
        consumerComplaintsResolvedPct: 92.6,
        notes: "Demonstration data. Not a filed disclosure.",
      },
    });
    await prisma.brsrCoreReport.create({
      data: {
        companyId: company.id,
        facilityId: facility.id,
        reportingPeriod: fy,
        status: "SUBMITTED",
        turnoverInr: round(18_400_000_000 * scale),
        waterWithdrawnKl: round(annualProduction * 1.21 * scale),
        waterDischargedKl: round(annualProduction * 0.26 * scale),
        wasteGeneratedTonnes: round(annualProduction * 0.041 * scale),
        wasteRecoveredTonnes: round(annualProduction * 0.033 * scale),
        renewableEnergyConsumptionGj: round(annualProduction * 0.42 * 0.18 * 3.6 * scale),
        nonRenewableEnergyConsumptionGj: round(annualProduction * 0.42 * 0.82 * 3.6 * scale),
        employeeCountTotal: Math.round(2_150 * scale),
        employeeCountFemale: Math.round(2_150 * scale * 0.271),
        wagesPaidMaleInr: round(1_642_000_000 * scale),
        wagesPaidFemaleInr: round(548_000_000 * scale),
        safetyIncidentsCount: fi === 0 ? 3 : 1,
        womenInWorkforcePct: 27.1,
        womenInManagementPct: 18.4,
        procurementFromMsmePct: 34.6,
        consumerComplaintsCount: fi === 0 ? 42 : 17,
        consumerComplaintsResolvedPct: 95.2,
        notes: "Demonstration data. Not a filed disclosure.",
      },
    });
  }

  // --- ISSB S1/S2 ----------------------------------------------------------
  await prisma.issbS1S2Report.create({
    data: {
      companyId: company.id,
      facilityId: facilities[0].id,
      reportingPeriod: fy,
      status: "SUBMITTED",
      governanceBodyOversight:
        "The Board's Risk and Sustainability Committee holds climate oversight and reviews progress quarterly. Climate targets carry a 12% weighting in executive scorecards.",
      managementRole:
        "The Head of Sustainability chairs a cross-functional Climate Working Group drawn from operations, procurement and finance, reporting monthly to the MD.",
      climateRisksOpportunities:
        "Physical: water stress at the Coimbatore site under the Cauvery basin allocation. Transition: customer decarbonisation requirements in the EU switchgear supply chain and rising grid tariffs. Opportunity: low-carbon castings for the wind and rail segments.",
      businessModelImpact:
        "Roughly 31% of revenue is exposed to customers with published Scope 3 targets, which is expected to make product-level emissions a qualification criterion within three years.",
      financialEffects:
        "Capital allocation of INR 84 crore to electrification and captive solar over FY2026-28. No material impairment identified in the current period.",
      scenarioAnalysisResilience:
        "Assessed under IEA STEPS and NZE 2050. Under NZE the principal exposure is purchased electricity cost; the modelled captive solar and PPA mix mitigates the majority of it by 2030.",
      riskIdentificationProcess:
        "Climate risks are identified through the enterprise risk process on a semi-annual cycle, with site-level physical risk screening using public basin and cyclone hazard data.",
      riskManagementProcess:
        "Scored on the same likelihood/impact matrix as all enterprise risks, so climate items compete for mitigation capital on equal terms.",
      riskIntegrationOverall:
        "Climate risk is a standing item on the enterprise risk register rather than a parallel process.",
      targetDescription: "42% reduction in Scope 1 and 2 emissions intensity against a FY2021-22 baseline.",
      targetYear: 2032,
      baselineYear: 2022,
      transitionPlan:
        "Three levers: captive and open-access renewables to 45% of electricity, furnace electrification at Hosur, and supplier engagement across the top 40 by spend.",
      internalCarbonPriceInr: 1_850,
      climateCapexInr: 840_000_000,
      notes: "Demonstration data. Not a filed disclosure.",
    },
  });

  // --- Scope 3 -------------------------------------------------------------
  const scope3Rows: {
    category: "CAT1_PURCHASED_GOODS_SERVICES" | "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION" | "CAT6_BUSINESS_TRAVEL" | "CAT7_EMPLOYEE_COMMUTING" | "CAT11_USE_OF_SOLD_PRODUCTS";
    method: "SPEND_BASED" | "ACTIVITY_BASED";
    emissions: number;
    input: Prisma.InputJsonValue;
    source: string;
  }[] = [
    {
      category: "CAT1_PURCHASED_GOODS_SERVICES",
      method: "SPEND_BASED",
      emissions: 48_620,
      input: { spendInr: 7_940_000_000, categoryBreakdown: { steel: 0.46, electronics: 0.21, packaging: 0.09, services: 0.24 } },
      source: "DEFRA 2025 spend-based factors (demonstration data)",
    },
    {
      category: "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION",
      method: "ACTIVITY_BASED",
      emissions: 6_180,
      input: { tonneKm: 61_800_000, mode: "ROAD_HGV" },
      source: "GLEC Framework v3 road freight (demonstration data)",
    },
    {
      category: "CAT6_BUSINESS_TRAVEL",
      method: "ACTIVITY_BASED",
      emissions: 742,
      input: { airPassengerKm: 3_120_000, railPassengerKm: 480_000 },
      source: "DEFRA 2025 business travel factors (demonstration data)",
    },
    {
      category: "CAT7_EMPLOYEE_COMMUTING",
      method: "ACTIVITY_BASED",
      emissions: 1_364,
      input: { employees: 2_150, avgCommuteKmPerDay: 18, workingDays: 244 },
      source: "DEFRA 2025 passenger vehicle factors (demonstration data)",
    },
    {
      category: "CAT11_USE_OF_SOLD_PRODUCTS",
      method: "ACTIVITY_BASED",
      emissions: 92_400,
      input: { unitsSold: 154_000, lifetimeKwhPerUnit: 820, gridFactorTco2PerMwh: 0.716 },
      source: "CEA Grid Emission Factor Report FY2025-26 (demonstration data)",
    },
  ];
  for (const row of scope3Rows) {
    await prisma.scope3Data.create({
      data: {
        companyId: company.id,
        facilityId: facilities[0].id,
        reportingPeriod: fy,
        category: row.category,
        calculationMethod: row.method,
        inputData: row.input,
        calculatedEmissionsTco2e: row.emissions,
        emissionFactorSource: row.source,
        status: "SUBMITTED",
      },
    });
  }

  // --- Supplier ESG Scorecard ---------------------------------------------
  const suppliers: {
    name: string;
    sector: string;
    country: string;
    hasEsgDisclosure: boolean;
    esgDisclosureType?: string;
    riskFlag: "LOW" | "MEDIUM" | "HIGH" | "NOT_ASSESSED";
    spendSharePct: number;
    riskNotes?: string;
  }[] = [
    { name: "Bharat Alloy Castings Pvt Ltd", sector: "Ferrous castings", country: "India", hasEsgDisclosure: true, esgDisclosureType: "BRSR Core FY2024-25", riskFlag: "LOW", spendSharePct: 18.4 },
    { name: "Kavery Steel Traders", sector: "Steel distribution", country: "India", hasEsgDisclosure: false, riskFlag: "MEDIUM", spendSharePct: 12.7, riskNotes: "No disclosure held. Sole-source for two grades; alternate qualification in progress." },
    { name: "Shenzhen Kaida Electronics Co", sector: "Electronic components", country: "China", hasEsgDisclosure: true, esgDisclosureType: "CDP response 2025", riskFlag: "MEDIUM", spendSharePct: 11.2, riskNotes: "Discloses to CDP but no site audit held." },
    { name: "Nordex Polymer Solutions GmbH", sector: "Engineering polymers", country: "Germany", hasEsgDisclosure: true, esgDisclosureType: "CSRD sustainability statement FY2024", riskFlag: "LOW", spendSharePct: 8.9 },
    { name: "Tirupur Packaging Industries", sector: "Packaging", country: "India", hasEsgDisclosure: false, riskFlag: "HIGH", spendSharePct: 6.3, riskNotes: "No disclosure held and no response to two engagement requests. Flagged for review at the next sourcing cycle." },
    { name: "Coimbatore Logistics Partners", sector: "Road freight", country: "India", hasEsgDisclosure: false, riskFlag: "MEDIUM", spendSharePct: 5.1 },
    { name: "Anand Surface Treatment Works", sector: "Plating and coating", country: "India", hasEsgDisclosure: true, esgDisclosureType: "ISO 14001 certificate + effluent returns", riskFlag: "MEDIUM", spendSharePct: 4.4, riskNotes: "Effluent-intensive process; discharge consent verified annually." },
    { name: "Hosur Precision Tools", sector: "Tooling", country: "India", hasEsgDisclosure: false, riskFlag: "NOT_ASSESSED", spendSharePct: 3.2 },
  ];
  for (const sup of suppliers) {
    await prisma.supplier.create({
      data: {
        companyId: company.id,
        name: sup.name,
        sector: sup.sector,
        country: sup.country,
        hasEsgDisclosure: sup.hasEsgDisclosure,
        esgDisclosureType: sup.esgDisclosureType,
        riskFlag: sup.riskFlag,
        riskNotes: sup.riskNotes,
        spendSharePct: sup.spendSharePct,
        lastReviewedAt: new Date(anchor.getTime() - 45 * 24 * 60 * 60 * 1000),
        status: "SUBMITTED",
      },
    });
  }

  // --- GRI Standards 2021 --------------------------------------------------
  // The ESG overview evaluates GRI completeness from the materiality
  // assessment and the per-topic rows rather than from columns on the report,
  // so a report without a completed assessment and material topics reads as
  // incomplete no matter how many disclosures hang off it.
  const griReport = await prisma.griReport.create({
    data: {
      companyId: company.id,
      facilityId: facilities[0].id,
      reportingPeriod: fy,
      status: "SUBMITTED",
      turnoverInr: 18_400_000_000,
      notes: "Demonstration data. Not a filed disclosure.",
      materialityAssessment: {
        create: {
          stakeholderGroups: ["Employees", "Customers", "Suppliers", "Local communities", "Investors", "Regulators"],
          stakeholderEngagementApproach:
            "Annual structured engagement: employee survey, top-40 supplier review, customer sustainability questionnaires, and quarterly community consultation at both sites.",
          impactIdentificationProcess:
            "Impacts were identified from operational data, sector guidance and stakeholder input, then mapped across the value chain from raw material through use phase.",
          prioritisationProcess:
            "Each impact scored 1-5 on severity and likelihood by the Climate Working Group, moderated in a workshop with external facilitation. Topics scoring at or above 3 were treated as material.",
          materialityThreshold: 3,
          completedAt: new Date(anchor.getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      },
      universalDisclosures: {
        create: {
          legalName: "DEMO - Nilgiri Industries Limited",
          ownershipLegalForm: "Public limited company incorporated in India",
          headquartersLocation: "Coimbatore, Tamil Nadu, India",
          countriesOfOperation: "India (manufacturing), with export sales to the EU, UK and Middle East",
          entitiesIncluded: "Nilgiri Industries Limited and its two manufacturing units. No entity in the financial statements is excluded.",
          reportingFrequency: "Annual, aligned to the Indian financial year",
          contactPoint: "sustainability@demo-nilgiri.invalid",
          externalAssurancePolicy: "Limited assurance is sought over BRSR Core attributes; the wider GRI content is unassured.",
          assuranceProvider: "Independent assurance provider (demonstration data)",
          assuranceLevel: "Limited",
          sectorsServed: "Automotive, wind energy, rail and electrical distribution",
          valueChainDescription:
            "Upstream: ferrous and polymer feedstock, electronic components. Own operations: casting, machining, assembly. Downstream: OEM customers and their end users.",
          employeesTotal: 2_150,
          employeesFemale: 583,
          employeesMale: 1_567,
          employeesPermanent: 1_704,
          employeesTemporary: 446,
          employeesFullTime: 2_098,
          employeesPartTime: 52,
          employeeDataMethodology: "Headcount at 31 March, from the payroll system.",
          nonEmployeeWorkersTotal: 318,
          nonEmployeeWorkersDescription: "Contracted housekeeping, security, canteen and periodic maintenance crews.",
          governanceStructure: "Nine-member Board with four independent directors. Risk and Sustainability Committee holds climate and ESG oversight.",
          governanceCommittees: "Audit; Nomination and Remuneration; Risk and Sustainability; Stakeholder Relationship",
          chairIsSeniorExecutive: false,
          chairRoleDescription: "The Chair is a non-executive independent director.",
          governanceImpactOversight: "The Risk and Sustainability Committee reviews material impacts quarterly and reports to the full Board twice a year.",
          criticalConcernsProcess: "Concerns are raised through the whistleblower channel and escalated to the Audit Committee Chair.",
          criticalConcernsCount: 2,
          compensationRatio: 41.6,
          compensationRatioIncreasePct: 2.4,
          publicationDate: new Date(anchor.getTime() - 30 * 24 * 60 * 60 * 1000),
          restatements: "No restatements of previously reported information in this period.",
          significantChangesToValueChain: "No significant change in size, structure, ownership or supply chain during the period.",
          governanceNominationProcess:
            "Directors are nominated by the Nomination and Remuneration Committee against a skills matrix that includes climate and sustainability competence.",
          impactResponsibilityDelegation:
            "Day-to-day responsibility for managing impacts sits with the Head of Sustainability, reporting to the Managing Director.",
          governanceReportingRole:
            "Material impacts are reported to the Risk and Sustainability Committee quarterly and to the full Board twice a year.",
          governanceCollectiveKnowledge:
            "The Board received two briefings on CBAM, CCTS and BRSR Core developments during the period.",
          governancePerformanceEvaluation:
            "Board performance is evaluated annually by the Nomination and Remuneration Committee, including oversight of sustainability topics.",
          remunerationPolicies:
            "Executive remuneration comprises fixed pay, an annual bonus with a 12% sustainability weighting, and long-term incentives.",
          remunerationProcess:
            "Set by the Nomination and Remuneration Committee and approved by shareholders at the AGM.",
          sustainableDevelopmentStatement:
            "The Managing Director's statement sets out the decarbonisation strategy and its link to the group's growth plan.",
          policyCommitments:
            "Group EHS and Sustainability Policy, Supplier Code of Conduct, Human Rights Policy and Anti-Bribery Policy, all Board-approved.",
          humanRightsPolicyCommitment:
            "The Human Rights Policy references the UN Guiding Principles and the ILO core conventions, and extends to contracted workers.",
          policyEmbedding:
            "Policies are embedded through induction, annual refresher training, and Supplier Code acceptance as a purchase-order condition.",
          remediationProcesses:
            "Grievances are investigated by the Ethics Committee, with remedy agreed with the affected party and tracked to closure.",
          adviceAndConcernsMechanisms:
            "A whistleblower helpline operated by an independent third party, plus site-level grievance boxes and the works committee.",
          significantFinesCount: 0,
          significantFinesValueInr: 0,
          nonMonetarySanctionsCount: 0,
          complianceIncidentsDescription: "No significant instances of non-compliance with laws or regulations in the period.",
          membershipAssociations: "Confederation of Indian Industry; Indian Foundry Association; Indian Electrical and Electronics Manufacturers Association.",
          stakeholderEngagementApproach:
            "Annual structured engagement across employees, customers, suppliers, communities, investors and regulators, with outcomes fed into the materiality process.",
          collectiveBargainingCoveragePct: 62.4,
          collectiveBargainingDescription:
            "Workmen at both units are covered by long-term settlements negotiated with the recognised union.",
        },
      },
      energyDisclosure: {
        create: {
          nonRenewableFuelGj: round(annualProduction * 1.9 * 0.85),
          renewableFuelGj: 0,
          electricityConsumedGj: round(annualProduction * 0.42 * 3.6),
          energyStandardsUsed: "GHG Protocol Corporate Standard; ISO 50001 energy review at both units",
          intensityDenominatorDescription: "Tonnes of finished product",
          intensityIncludesOutsideOrg: false,
          energyReductionGj: round(annualProduction * 0.42 * 3.6 * 0.061),
          energyReductionBaseYear: 2022,
          energyReductionBasis: "Compressed air system rebuild, furnace insulation upgrade and LED conversion across both units.",
        },
      },
      waterDisclosure: {
        create: {
          interactionsNarrative:
            "Both units draw from municipal supply supplemented by groundwater. The Coimbatore unit sits in a basin classified as water-stressed, and operates a zero-liquid-discharge recovery loop for process water.",
          waterStressAssessmentTool: "WRI Aqueduct 4.0 baseline water stress",
          dischargeImpactManagement: "Effluent is treated on site to Tamil Nadu Pollution Control Board consent limits before discharge to the common effluent network.",
          minimumEffluentStandards: "TNPCB consent conditions; discharge tested monthly by an NABL-accredited laboratory.",
          withdrawalTotalMl: round((annualProduction * 1.21) / 1000, 3),
          withdrawalWaterStressedMl: round((annualProduction * 1.21 * 0.65) / 1000, 3),
          withdrawalFreshwaterMl: round((annualProduction * 0.86) / 1000, 3),
          dischargeTotalMl: round((annualProduction * 0.26) / 1000, 3),
          consumptionTotalMl: round((annualProduction * 0.95) / 1000, 3),
          prioritySubstancesOfConcern: "Hexavalent chromium and total dissolved solids, both monitored against consent limits.",
        },
      },
      emissionsDisclosure: {
        create: {
          baseYear: 2022,
          gasesIncluded: "CO2, CH4, N2O",
          consolidationApproach: "Operational control",
          emissionsStandardsUsed: "GHG Protocol Corporate Standard; IPCC 2006 Guidelines; CEA grid emission factor FY2025-26",
          intensityDenominatorDescription: "Tonnes of finished product",
          intensityGasesIncluded: "CO2, CH4, N2O expressed as CO2e using IPCC AR5 GWP",
          reductionBaseYear: 2022,
          reductionScopesIncluded: "Scope 1 and Scope 2 (location-based)",
          noxTonnes: 41.2,
          soxTonnes: 12.8,
          particulateMatterTonnes: 9.4,
          vocTonnes: 6.1,
        },
      },
      wasteDisclosure: {
        create: {
          wasteImpactsNarrative:
            "The dominant streams are foundry sand, metal swarf and packaging. Swarf and metallics return to the melt or to authorised recyclers; spent sand is reclaimed on site.",
          wasteManagementNarrative: "Segregation at source across nine streams, with authorised handlers for all hazardous categories.",
          thirdPartyWasteManagement: "Hazardous waste is transferred to TNPCB-authorised recyclers and disposal facilities under manifest.",
          wasteCompositionDescription: "Foundry sand 46%, metallic swarf 31%, packaging 14%, hazardous (oils, sludge, spent solvent) 9%",
          nonHazardousDivertedRecyclingT: round(annualProduction * 0.026),
          nonHazardousDivertedReuseT: round(annualProduction * 0.005),
          hazardousDivertedRecyclingT: round(annualProduction * 0.002),
          hazardousDisposalLandfillT: round(annualProduction * 0.0016),
          hazardousDisposalIncinerationWithRecoveryT: round(annualProduction * 0.0009),
        },
      },
      employmentDisclosure: {
        create: {
          newHiresTotal: 289,
          newHiresFemale: 94,
          turnoverTotal: 241,
          turnoverFemale: 71,
          benefitsDescription: "Group medical cover, term life, gratuity, subsidised transport and canteen, extended to permanent and fixed-term employees alike.",
          parentalLeaveEntitledMale: 1_567,
          parentalLeaveEntitledFemale: 583,
          parentalLeaveTookMale: 74,
          parentalLeaveTookFemale: 41,
          parentalLeaveReturnedMale: 73,
          parentalLeaveReturnedFemale: 36,
          parentalLeaveRetainedMale: 69,
          parentalLeaveRetainedFemale: 31,
        },
      },
      ohsDisclosure: {
        create: {
          managementSystemDescription: "ISO 45001 certified at both units, covering employees and on-site contractors.",
          hazardIdentificationProcess: "Job safety analysis for every routine task, plus a permit-to-work system for hot work, confined space and work at height.",
          occupationalHealthServices: "On-site occupational health centre with a full-time medical officer at Coimbatore and a visiting officer at Hosur.",
          workerParticipation: "Joint management-worker safety committees at both units, meeting monthly.",
          workerOhsTraining: "Induction plus annual refresher for all workers; specialised training for permit-to-work activities.",
          workersCoveredCount: 2_468,
          workersCoveredPct: 100,
          hoursWorked: 5_243_000,
          fatalitiesEmployees: 0,
          fatalitiesNonEmployees: 0,
          highConsequenceInjuriesEmployees: 1,
          highConsequenceInjuriesNonEmployees: 0,
        },
      },
      trainingDisclosure: {
        create: {
          avgTrainingHoursPerEmployee: 21.4,
          avgTrainingHoursMale: 20.8,
          avgTrainingHoursFemale: 23.0,
          avgTrainingHoursManagement: 28.6,
          avgTrainingHoursNonManagement: 19.7,
          skillsProgramsDescription: "Apprenticeship intake, multi-skilling for machine operators, and a supervisory development programme.",
          transitionAssistanceDescription: "Retirement planning and outplacement support where roles are restructured.",
          performanceReviewPct: 94.3,
          performanceReviewMalePct: 94.1,
          performanceReviewFemalePct: 94.8,
        },
      },
      supplierEnvDisclosure: {
        create: {
          newSuppliersScreenedPct: 78.5,
          newSuppliersTotalCount: 61,
          screeningCriteria:
            "New suppliers are screened on environmental consents, hazardous waste authorisation, and acceptance of the Supplier Code of Conduct.",
          suppliersAssessedCount: 40,
          suppliersWithNegativeImpactsCount: 6,
          suppliersWithImprovementsAgreedCount: 5,
          suppliersTerminatedCount: 1,
          negativeImpactsDescription:
            "Six suppliers showed gaps in effluent monitoring or hazardous waste manifests. Five agreed time-bound improvement plans; one was exited at contract end.",
        },
      },
      diversityDisclosure: {
        create: {
          governanceBodyTotal: 9,
          governanceBodyFemale: 2,
          employeesFemalePct: 27.1,
          salaryRatioOverall: 0.94,
          salaryRatioManagement: 0.91,
          salaryRatioNonManagement: 0.97,
          salaryRatioBasis: "Ratio of median female to median male basic remuneration, by employee category.",
          otherDiversityIndicators: "8.2% of the workforce is from a recognised disadvantaged category; 1.1% declare a disability.",
        },
      },
    },
  });

  // Material and non-material topics both matter: the content index has to
  // show a rationale for what was screened out, not just what was kept.
  const griTopics: { code: string; material: boolean; score?: number; rank?: number; rationale?: string }[] = [
    { code: "GRI_302", material: true, score: 4.6, rank: 1 },
    { code: "GRI_305", material: true, score: 4.5, rank: 2 },
    { code: "GRI_403", material: true, score: 4.4, rank: 3 },
    { code: "GRI_303", material: true, score: 4.1, rank: 4 },
    { code: "GRI_306", material: true, score: 3.8, rank: 5 },
    { code: "GRI_404", material: true, score: 3.4, rank: 6 },
    { code: "GRI_405", material: true, score: 3.2, rank: 7 },
    { code: "GRI_308", material: true, score: 3.1, rank: 8 },
    { code: "GRI_301", material: false, rationale: "Materials use is dominated by recycled ferrous input already reported under GRI 306; scored 2.4, below the threshold." },
    { code: "GRI_413", material: false, rationale: "Neither site borders a resettlement or indigenous community; community impact scored 2.1." },
    { code: "GRI_418", material: false, rationale: "No consumer personal data is processed; the business sells to OEMs. Scored 1.4." },
  ];
  for (const t of griTopics) {
    await prisma.griMaterialTopic.create({
      data: {
        griReportId: griReport.id,
        topicCode: t.code,
        isMaterial: t.material,
        significanceScore: t.score,
        rank: t.rank,
        notMaterialRationale: t.rationale,
        impactsDescription: t.material ? "Assessed as a material impact through the FY materiality process; managed under the topic policies below." : undefined,
        involvementDescription: t.material ? "The impact is caused by our own operations and contributed to through the upstream supply chain." : undefined,
        policiesCommitments: t.material ? "Covered by the group EHS and Sustainability Policy, approved by the Board." : undefined,
        actionsTaken: t.material ? "Site-level improvement plans with quarterly review by the Climate Working Group." : undefined,
        effectivenessTracking: t.material ? "Tracked against the FY target set for this topic and reported to the Risk and Sustainability Committee." : undefined,
        stakeholderEngagement: t.material ? "Raised in the annual employee survey and top-40 supplier review." : undefined,
      },
    });
  }

  // --- Decarbonisation targets, so the trajectory chart has a line to draw ---
  // The trajectory widget reads CompanyTarget; without one it renders its
  // "no target set" empty state no matter how much actual emissions data
  // exists behind it.
  await prisma.companyTarget.create({
    data: {
      companyId: company.id,
      kind: "INTENSITY",
      scopesCovered: "Scope 1 and Scope 2 (location-based)",
      baselineYear: 2022,
      baselineEmissionsTco2e: 24_180,
      targetYear: 2032,
      reductionPct: 42,
      intensityMetric: "tCO2e per tonne of finished product",
      baselineIntensity: 0.61,
      targetIntensity: 0.354,
      isNetZero: false,
      sbtiStatus: "COMMITTED",
      description: "42% reduction in Scope 1 and 2 emissions intensity by FY2031-32 against an FY2021-22 baseline.",
      status: "SUBMITTED",
    },
  });
  await prisma.companyTarget.create({
    data: {
      companyId: company.id,
      kind: "ABSOLUTE",
      scopesCovered: "Scope 1, Scope 2 and Scope 3",
      baselineYear: 2022,
      baselineEmissionsTco2e: 24_180,
      targetYear: 2050,
      reductionPct: 90,
      isNetZero: true,
      sbtiStatus: "COMMITTED",
      description: "Net zero across all three scopes by 2050, with residual emissions addressed through permanent removals.",
      status: "SUBMITTED",
    },
  });

  // --- Product SKUs, for the per-product footprint allocation --------------
  const skus: { facilityIndex: number; name: string; code: string; qty: number }[] = [
    { facilityIndex: 0, name: "Ductile iron housing DN150", code: "CST-DI-150", qty: 31_400 },
    { facilityIndex: 0, name: "Machined gearbox casing", code: "CST-GBX-04", qty: 24_800 },
    { facilityIndex: 0, name: "Wind hub casting 3.2 MW", code: "CST-WND-32", qty: 12_600 },
    { facilityIndex: 1, name: "LV switchgear assembly", code: "ELC-SWG-LV", qty: 18_900 },
    { facilityIndex: 1, name: "Transformer core laminate", code: "ELC-TXC-08", qty: 15_300 },
  ];
  for (const sku of skus) {
    await prisma.productSku.create({
      data: {
        companyId: company.id,
        facilityId: facilities[sku.facilityIndex].id,
        name: sku.name,
        skuCode: sku.code,
        reportingPeriod: fy,
        productionQuantity: sku.qty,
        unit: "TONNE",
        status: "SUBMITTED",
      },
    });
  }

  // --- Voluntary offsets, so the offsets card has a position to show -------
  await prisma.voluntaryOffsetPurchase.create({
    data: {
      companyId: company.id,
      facilityId: facilities[0].id,
      registry: "VERRA",
      // Removal rather than avoidance: the offsets card separates the two, and
      // a demo showing only avoidance credits misrepresents what the breakdown
      // is for.
      category: "REMOVAL_NATURE",
      creditSerialNumber: "VCS-DEMO-2026-004417",
      tonnageTco2e: 3_500,
      vintageYear: Number(fy.replace(/^FY/, "").slice(0, 4)),
      purchaseDate: new Date(anchor.getTime() - 90 * 24 * 60 * 60 * 1000),
      status: "SUBMITTED",
      notes: "Demonstration data. Retired against residual FY emissions.",
    },
  });

  // --- RECs, so the market-based electricity view has something to match ----
  await prisma.recPurchase.create({
    data: {
      companyId: company.id,
      facilityId: facilities[0].id,
      registry: "I_REC",
      certificateReference: "IREC-IN-DEMO-2026-0114",
      quantityMwh: 14_200,
      // fy is "FY2025-26" — strip the prefix before reading the start year,
      // or this is NaN and Prisma rejects the whole row.
      vintageYear: Number(fy.replace(/^FY/, "").slice(0, 4)),
      purchaseDate: new Date(anchor.getTime() - 120 * 24 * 60 * 60 * 1000),
      status: "SUBMITTED",
      notes: "Demonstration data.",
    },
  });

  return { company, facilities, fy, periods };
};

// ---------------------------------------------------------------------------
// Reports
//
// Generated through the real generateReport pipeline — the same call the
// dashboard's "Generate Report" button makes — rather than by inserting Report
// rows. A fabricated row would give a demo that lists a report it cannot open.
//
// Generation is gated on the regulatory reporting window being open for the
// period (periodStatusFor). That is a genuine product rule and this seed must
// not defeat it, so a closed window is logged and skipped rather than worked
// around. Whether a given report exists therefore depends on the date the seed
// is run, which is why the summary at the end lists what was actually created.
// ---------------------------------------------------------------------------
const tryGenerateReport = async (
  label: string,
  ownerId: string,
  facilityId: string,
  reportType: "CBAM" | "CCTS" | "BRSR" | "GRI",
): Promise<boolean> => {
  try {
    await generateReport(ownerId, facilityId, reportType);
    logger.info(`[DemoSeed] Generated ${reportType} report for ${label}`);
    return true;
  } catch (error) {
    const code = (error as { code?: string; message?: string }).code ?? "";
    const message = (error as { message?: string }).message ?? String(error);
    logger.warn(`[DemoSeed] Could not generate ${reportType} for ${label}: ${message}${code ? ` [${code}]` : ""}`);
    return false;
  }
};

export const seedDemoAccounts = async (): Promise<void> => {
  const anchor = new Date();
  const { password, generated: passwordWasGenerated } = resolvePassword();
  await purgeExistingDemos();

  const ccts = await seedCctsDemo(anchor, password);
  const cbam = await seedCbamDemo(anchor, password);
  const combined = await seedCombinedDemo(anchor, password);
  const esg = await seedEsgDemo(anchor, password);

  const generated: string[] = [];
  const record = async (label: string, ownerId: string, facilityId: string, type: "CBAM" | "CCTS" | "BRSR" | "GRI") => {
    if (await tryGenerateReport(label, ownerId, facilityId, type)) generated.push(`${label}: ${type}`);
  };

  await record(ccts.company.name, ccts.company.ownerId, ccts.facility.id, "CCTS");
  await record(cbam.company.name, cbam.company.ownerId, cbam.facility.id, "CBAM");
  await record(combined.company.name, combined.company.ownerId, combined.facility.id, "CBAM");
  await record(combined.company.name, combined.company.ownerId, combined.facility.id, "CCTS");
  await record(esg.company.name, esg.company.ownerId, esg.facilities[0].id, "BRSR");
  // GRI is not generated here. The dispatch builds it correctly now, but the
  // generate-report endpoint deliberately does not accept GRI: it is produced
  // and downloaded from GET /api/gri/report/:reportId/pdf, which streams the
  // PDF rather than storing a Report row. The SUBMITTED GriReport seeded above
  // is what that route renders.
  //
  // Nor is a CBAM Communication Package generated, for either CBAM demo. Its
  // filing window is a real regulatory calendar rule and this seed does not
  // defeat it. The CBAM demo shows its position through
  // GET /api/facilities/:facilityId/cbam-executive-summary, which is
  // deliberately not window-gated because it is an internal management
  // document rather than a submission, and which renders the same net
  // liability, certificate count and volume-in-scope from the same
  // calculation. See the note in report.service.ts on why loadReportContext
  // was split out from getReportContext.

  logger.info("");
  logger.info("[DemoSeed] ======================================================");
  logger.info("[DemoSeed] 4 demo companies seeded.");
  logger.info(
    passwordWasGenerated
      ? `[DemoSeed] Generated password (shown once, nothing stores it): ${password}`
      : "[DemoSeed] Password: the DEMO_ACCOUNT_PASSWORD you supplied.",
  );
  for (const email of DEMO_EMAILS) logger.info(`[DemoSeed]   ${email}`);
  logger.info(`[DemoSeed] Reports generated: ${generated.length ? generated.join(", ") : "none (all windows closed)"}`);
  logger.info("[DemoSeed] All four carry isDemoAccount: true and are excluded");
  logger.info("[DemoSeed] from Super Admin overview counts and revenue reporting.");
  logger.info("[DemoSeed] ======================================================");
};

if (require.main === module) {
  const allowRemote = process.argv.includes("--allow-remote-db");
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!isLocal && !allowRemote) {
    logger.error(
      `[DemoSeed] Refusing to write demo tenant data to a non-local database (${url.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@")}). ` +
        "Re-run with --allow-remote-db if this is genuinely intended.",
    );
    process.exit(1);
  }
  seedDemoAccounts()
    .catch((error) => {
      logger.error("[DemoSeed] Failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
