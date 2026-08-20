import { prisma } from "../config/prisma";

/**
 * Backfill of CompanyTarget from the target data ISSB and CDP already hold.
 *
 * ===========================================================================
 * ADDITIVE ONLY. This never writes to, clears or rewrites an ISSB report or a
 * CDP response. It reads them, and it inserts CompanyTarget rows. The old
 * fields stay exactly where they are and keep working — the frameworks fall
 * back to the register only where they have no value of their own, so leaving
 * their data in place is what makes the transition non-breaking.
 *
 * It is also idempotent: a company that already has any CompanyTarget row is
 * skipped entirely. Re-running cannot duplicate a target, and cannot overwrite
 * a target the company entered by hand — a hand-entered target is the
 * company's own statement and outranks anything inferred from a framework
 * form.
 * ===========================================================================
 *
 * CONFLICTS ARE FLAGGED, NEVER SILENTLY RESOLVED. Where ISSB and CDP both
 * describe a target and disagree about it, ISSB is written (it is the primary
 * source) and the disagreement is reported field by field. The point is that
 * somebody looks: two disagreeing targets in one company's own filings is a
 * data-quality problem this script must surface rather than launder into a
 * single confident-looking row.
 */

/** A target as one framework states it, reduced to the fields both share. */
export interface BackfillCandidate {
  baselineYear: number;
  baselineEmissionsTco2e: number;
  targetYear: number;
  reductionPct: number | null;
  scopesCovered: string | null;
}

export type BackfillSource = "ISSB" | "CDP";

export interface BackfillConflict {
  field: "baselineYear" | "targetYear" | "baselineEmissionsTco2e";
  issb: number;
  cdp: number;
}

export interface BackfillResolution {
  /** Null when neither framework holds enough to state a target. */
  chosen: (BackfillCandidate & { source: BackfillSource }) | null;
  conflicts: BackfillConflict[];
  reason: string;
}

/**
 * Emissions figures are floats that have been through a display rounding at
 * some point, so an exact comparison would report conflicts that are not real
 * disagreements. A tonne is below the precision anyone states a baseline to.
 */
const TCO2E_TOLERANCE = 1;

/**
 * A candidate needs all three of baseline year, baseline emissions and target
 * year to be a target at all. `reductionPct` is genuinely optional: ISSB does
 * not capture one, and a target without it is still worth recording — it just
 * cannot be tracked, which evaluateTargetProgress already reports honestly.
 */
export const isUsableCandidate = (c: Partial<BackfillCandidate> | null): c is BackfillCandidate =>
  c != null && c.baselineYear != null && c.baselineEmissionsTco2e != null && c.targetYear != null;

/**
 * Picks the row to write and lists every field the two sources disagree on.
 *
 * ISSB wins on conflict. That is a deliberate ordering, not a coin toss: an
 * ISSB S1/S2 statement is a general-purpose financial disclosure covering the
 * whole entity, while a CdpTarget hangs off one facility's questionnaire
 * response, so the ISSB figure is the one stated at the level CompanyTarget
 * models.
 */
export const resolveBackfill = (
  issb: Partial<BackfillCandidate> | null,
  cdp: Partial<BackfillCandidate> | null,
): BackfillResolution => {
  const issbOk = isUsableCandidate(issb);
  const cdpOk = isUsableCandidate(cdp);

  if (!issbOk && !cdpOk) {
    return { chosen: null, conflicts: [], reason: "Neither ISSB nor CDP states a complete target." };
  }
  if (issbOk && !cdpOk) {
    return { chosen: { ...issb, source: "ISSB" }, conflicts: [], reason: "Only ISSB states a target." };
  }
  if (!issbOk && cdpOk) {
    return { chosen: { ...cdp, source: "CDP" }, conflicts: [], reason: "Only CDP states a target." };
  }

  const a = issb as BackfillCandidate;
  const b = cdp as BackfillCandidate;
  const conflicts: BackfillConflict[] = [];
  if (a.baselineYear !== b.baselineYear) {
    conflicts.push({ field: "baselineYear", issb: a.baselineYear, cdp: b.baselineYear });
  }
  if (a.targetYear !== b.targetYear) {
    conflicts.push({ field: "targetYear", issb: a.targetYear, cdp: b.targetYear });
  }
  if (Math.abs(a.baselineEmissionsTco2e - b.baselineEmissionsTco2e) > TCO2E_TOLERANCE) {
    conflicts.push({
      field: "baselineEmissionsTco2e",
      issb: a.baselineEmissionsTco2e,
      cdp: b.baselineEmissionsTco2e,
    });
  }

  return {
    chosen: {
      ...a,
      // CDP is the only one of the two that captures these, so take them from
      // it where ISSB has nothing to say. This is gap-filling within the
      // chosen row, not a merge of two disagreeing targets.
      reductionPct: a.reductionPct ?? b.reductionPct,
      scopesCovered: a.scopesCovered ?? b.scopesCovered,
      source: "ISSB",
    },
    conflicts,
    reason:
      conflicts.length > 0
        ? `ISSB and CDP disagree on ${conflicts.map((c) => c.field).join(", ")}; wrote ISSB and flagged the conflict.`
        : "ISSB and CDP agree.",
  };
};

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * The ISSB-stated target for a company.
 *
 * Submitted reports are preferred over drafts, then the latest period, since
 * a signed statement is the better record of what the company says its target
 * is. Reports that state none of the three fields are ignored rather than
 * treated as an empty target.
 */
export const issbCandidateFor = async (companyId: string): Promise<Partial<BackfillCandidate> | null> => {
  const reports = await prisma.issbS1S2Report.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { reportingPeriod: "desc" }],
    select: { targetYear: true, baselineYear: true, baselineEmissionsTco2e: true, status: true },
  });
  // status: SUBMITTED sorts before DRAFT alphabetically, which is the order
  // wanted here — but say so explicitly rather than leaning on the enum's
  // spelling, which a future value could break.
  const ordered = [...reports].sort((x, y) => (x.status === y.status ? 0 : x.status === "SUBMITTED" ? -1 : 1));
  const hit = ordered.find(
    (r) => r.baselineYear != null && r.baselineEmissionsTco2e != null && r.targetYear != null,
  );
  if (!hit) return null;
  return {
    baselineYear: hit.baselineYear!,
    baselineEmissionsTco2e: hit.baselineEmissionsTco2e!,
    targetYear: hit.targetYear!,
    reductionPct: null,
    scopesCovered: null,
  };
};

/**
 * The CDP-stated target for a company — the nearest-term absolute one, which
 * is the same rule primaryCompanyTarget uses when frameworks read back out.
 */
export const cdpCandidateFor = async (companyId: string): Promise<Partial<BackfillCandidate> | null> => {
  const row = await prisma.cdpTarget.findFirst({
    where: { kind: "ABSOLUTE", cdpReport: { companyId } },
    orderBy: [{ targetYear: "asc" }, { createdAt: "asc" }],
    select: {
      baseYear: true,
      baseYearEmissionsTco2e: true,
      targetYear: true,
      reductionPct: true,
      scopesCovered: true,
    },
  });
  if (!row || row.baseYearEmissionsTco2e == null) return null;
  return {
    baselineYear: row.baseYear,
    baselineEmissionsTco2e: row.baseYearEmissionsTco2e,
    targetYear: row.targetYear,
    reductionPct: row.reductionPct,
    scopesCovered: row.scopesCovered,
  };
};

export interface BackfillReport {
  companyId: string;
  companyName: string;
  outcome: "CREATED" | "SKIPPED_HAS_TARGET" | "NO_SOURCE";
  source: BackfillSource | null;
  conflicts: BackfillConflict[];
  reason: string;
}

/**
 * Runs the backfill. `apply` false (the default) computes and reports without
 * writing anything, so the conflict list can be read before any row is
 * inserted.
 */
export const backfillCompanyTargets = async (apply = false): Promise<BackfillReport[]> => {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const out: BackfillReport[] = [];

  for (const company of companies) {
    const existing = await prisma.companyTarget.count({ where: { companyId: company.id } });
    if (existing > 0) {
      out.push({
        companyId: company.id,
        companyName: company.name,
        outcome: "SKIPPED_HAS_TARGET",
        source: null,
        conflicts: [],
        reason: `Already has ${existing} target(s); left untouched.`,
      });
      continue;
    }

    const [issb, cdp] = await Promise.all([issbCandidateFor(company.id), cdpCandidateFor(company.id)]);
    const resolution = resolveBackfill(issb, cdp);

    if (!resolution.chosen) {
      out.push({
        companyId: company.id,
        companyName: company.name,
        outcome: "NO_SOURCE",
        source: null,
        conflicts: [],
        reason: resolution.reason,
      });
      continue;
    }

    if (apply) {
      await prisma.companyTarget.create({
        data: {
          companyId: company.id,
          kind: "ABSOLUTE",
          scopesCovered: resolution.chosen.scopesCovered ?? "Scope 1+2 (location-based)",
          baselineYear: resolution.chosen.baselineYear,
          baselineEmissionsTco2e: resolution.chosen.baselineEmissionsTco2e,
          targetYear: resolution.chosen.targetYear,
          reductionPct: resolution.chosen.reductionPct,
          // DRAFT, not SUBMITTED. The company never entered this row in the
          // target register — it was inferred from another form — so it must
          // not arrive pre-signed. A draft is also invisible to the framework
          // fallbacks, which read submitted targets only, so backfilling
          // cannot change what any report currently displays until somebody
          // reviews the row and submits it.
          status: "DRAFT",
          description: `Backfilled from ${resolution.chosen.source}. ${resolution.reason}`,
        },
      });
    }

    out.push({
      companyId: company.id,
      companyName: company.name,
      outcome: "CREATED",
      source: resolution.chosen.source,
      conflicts: resolution.conflicts,
      reason: resolution.reason,
    });
  }

  return out;
};
