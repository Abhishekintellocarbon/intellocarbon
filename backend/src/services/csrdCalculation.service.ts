import { prisma } from "../config/prisma";
import type { Company, Facility, CsrdIro, CsrdMaterialTopic, Prisma } from "@prisma/client";
import { resolveFyWindow as resolveBrsrFyWindow, type BrsrFyWindow } from "./brsrCalculation.service";
import { computeImpactSignificance } from "./griCalculation.service";
import { buildWaterFootprint } from "./waterCalculation.service";
import {
  ESRS_STANDARDS,
  ESRS_2_DATAPOINTS,
  ESRS_REGISTRY_RECONCILED,
  ESRS_CONFIRMED_DATAPOINT_COUNT,
  ESRS_TOTAL_DATAPOINT_COUNT,
  getEsrsStandard,
} from "../data/esrsStandards";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** ESRS E1-5 states energy in MWh, unlike GRI 302's GJ. */
const GJ_TO_MWH = 1 / 3.6;

// Same "FY2025-26" parsing as every other framework here.
export type CsrdFyWindow = BrsrFyWindow;
export const resolveFyWindow = resolveBrsrFyWindow;

// ---------------------------------------------------------------------------
// Double materiality scoring
// ---------------------------------------------------------------------------

/**
 * Impact materiality — the outward axis.
 *
 * Delegates to GRI's computeImpactSignificance rather than reimplementing it.
 * That is not incidental reuse: ESRS deliberately aligned its impact
 * materiality with GRI's severity construction (scale, scope and
 * irremediability, weighted by likelihood for impacts that have not yet
 * occurred), so two implementations would be two chances to drift apart on
 * what is meant to be the same assessment. If they ever need to diverge, that
 * should be a deliberate change with a test naming the divergence, not a
 * silent copy that rots.
 */
export const computeImpactScore = (input: {
  impactType: CsrdIro["impactType"];
  scale: number;
  scope: number;
  irremediability?: number | null;
  likelihood?: number | null;
}): number =>
  computeImpactSignificance({
    impactType: input.impactType as NonNullable<CsrdIro["impactType"]>,
    scale: input.scale,
    scope: input.scope,
    irremediability: input.irremediability,
    likelihood: input.likelihood,
  });

/**
 * Financial materiality — the inward axis.
 *
 * Magnitude of the financial effect, weighted by the likelihood it
 * materialises. There is deliberately no severity construction here: a
 * financial risk has a size and a probability, not a scope or an
 * irremediability, and borrowing the impact axis's shape would imply a
 * precision the assessment does not have.
 *
 * Likelihood uses the same bounded 0.6-1.0 weight as the impact axis, for the
 * same reason: an unbounded likelihood factor lets a low probability erase a
 * severe financial exposure, and a matter that would be ruinous but unlikely
 * is exactly the kind ESRS expects to surface rather than suppress.
 */
const LIKELIHOOD_FLOOR = 0.5;

export const computeFinancialScore = (input: { magnitude: number; likelihood?: number | null }): number => {
  const weight =
    input.likelihood != null ? LIKELIHOOD_FLOOR + (1 - LIKELIHOOD_FLOOR) * (input.likelihood / 5) : 1;
  return round(input.magnitude * weight, 2);
};

export interface CsrdStandardScore {
  standardCode: string;
  /** Highest impact score among this standard's IROs, or null when none were scored on that axis. */
  impactScore: number | null;
  financialScore: number | null;
  impactMaterial: boolean;
  financialMaterial: boolean;
  /** ESRS makes a matter material if EITHER axis clears its threshold. */
  isMaterial: boolean;
  iroCount: number;
  rank: number;
}

/**
 * Rolls scored IROs up per ESRS standard.
 *
 * Two properties matter. Each standard takes the MAXIMUM score on each axis
 * rather than the mean — a standard is material if it has at least one
 * significant matter, so averaging would let a cluster of minor ones dilute a
 * severe one out of the statement. And the two axes are evaluated
 * independently against their own thresholds, then OR'd: a climate risk that
 * is financially severe but has limited outward impact is still material, and
 * so is the reverse. Requiring both would be a stricter test than ESRS sets
 * and would quietly drop matters the standard expects to see reported.
 */
export const rankStandardsByIros = (
  iros: Pick<CsrdIro, "standardCode" | "impactScore" | "financialScore">[],
  impactThreshold: number,
  financialThreshold: number,
): CsrdStandardScore[] => {
  const byStandard = new Map<string, { impact: number | null; financial: number | null; count: number }>();

  for (const iro of iros) {
    const existing = byStandard.get(iro.standardCode) ?? { impact: null, financial: null, count: 0 };
    if (iro.impactScore != null) {
      existing.impact = existing.impact == null ? iro.impactScore : Math.max(existing.impact, iro.impactScore);
    }
    if (iro.financialScore != null) {
      existing.financial =
        existing.financial == null ? iro.financialScore : Math.max(existing.financial, iro.financialScore);
    }
    existing.count += 1;
    byStandard.set(iro.standardCode, existing);
  }

  return Array.from(byStandard.entries())
    .map(([standardCode, { impact, financial, count }]) => {
      const impactMaterial = impact != null && impact >= impactThreshold;
      const financialMaterial = financial != null && financial >= financialThreshold;
      return {
        standardCode,
        impactScore: impact == null ? null : round(impact, 2),
        financialScore: financial == null ? null : round(financial, 2),
        impactMaterial,
        financialMaterial,
        isMaterial: impactMaterial || financialMaterial,
        iroCount: count,
      };
    })
    // Ordered by the stronger of the two axes so the statement opens on the
    // most significant matter, whichever direction carried it. Ties break on
    // code so a regenerated report does not reshuffle.
    .sort(
      (a, b) =>
        Math.max(b.impactScore ?? 0, b.financialScore ?? 0) - Math.max(a.impactScore ?? 0, a.financialScore ?? 0) ||
        a.standardCode.localeCompare(b.standardCode),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

// ---------------------------------------------------------------------------
// Reuse of existing platform data
// ---------------------------------------------------------------------------

export interface CsrdMetricsRollup {
  /** E1-6: AR5/GHG-Protocol basis, as ESRS follows GHG Protocol rather than India's AR2/BUR3. */
  scope1Tco2e: number;
  scope2LocationTco2e: number;
  scope3Tco2e: number | null;
  totalGhgTco2e: number;
  /** E1-5, in MWh as ESRS states it — not GRI 302's GJ. */
  totalEnergyMwh: number;
  renewableEnergyMwh: number;
  /** E3-4, in cubic metres as ESRS states it — not GRI 303's megalitres. */
  waterWithdrawalM3: number;
  waterDischargeM3: number;
  waterConsumptionM3: number;
  waterRecycledM3: number;
  hasWaterData: boolean;
  /** E5-5, from the GRI waste disclosure where one exists for the same period. */
  wasteGeneratedTonnes: number | null;
  wasteDivertedTonnes: number | null;
  wasteDisposalTonnes: number | null;
  hazardousWasteTonnes: number | null;
  /** E1-7b, from the voluntary offsets log. */
  carbonCreditsCancelledTco2e: number | null;
  productionQuantityT: number;
  activityDataCount: number;
}

export interface CsrdIntensities {
  /** E1-5d, MWh per euro of net revenue. */
  energyPerRevenue: number | null;
  /** E1-6e, tCO2e per euro of net revenue. */
  ghgPerRevenue: number | null;
  /** E3-4e, m3 per euro of net revenue. */
  waterPerRevenue: number | null;
}

/**
 * Reads what the platform already holds and recomputes nothing — the single
 * point of contact between CSRD and the existing engines, mirroring the GRI
 * and ISSB rollups.
 *
 * Waste comes from the GRI waste disclosure rather than a CSRD-specific entry,
 * because the two standards ask for the same underlying figures and asking a
 * facility to key its waste twice would guarantee the two reports eventually
 * disagree. Where no GRI waste disclosure exists for the period the fields
 * stay null and E5-5 is entered manually.
 */
export const rollupCsrdMetrics = async (
  facilityId: string,
  reportingPeriod: string,
  window: CsrdFyWindow,
): Promise<CsrdMetricsRollup> => {
  const [entries, scope3Rows, griWaste, offsets] = await Promise.all([
    prisma.activityData.findMany({
      where: {
        facilityId,
        status: "SUBMITTED",
        periodStart: { gte: window.start },
        periodEnd: { lt: window.end },
      },
      include: { calculationResult: true, waterEntries: true },
    }),
    prisma.scope3Data.findMany({
      where: { facilityId, reportingPeriod, status: "SUBMITTED" },
      select: { calculatedEmissionsTco2e: true },
    }),
    prisma.griWasteDisclosure.findFirst({
      where: { griReport: { facilityId, reportingPeriod } },
    }),
    prisma.voluntaryOffsetPurchase.findMany({
      where: { facilityId, status: "SUBMITTED" },
      select: { tonnageTco2e: true },
    }),
  ]);

  let scope1 = 0;
  let scope2 = 0;
  let energyMwh = 0;
  let renewableMwh = 0;
  let productionQuantityT = 0;
  let withdrawnM3 = 0;
  let dischargedM3 = 0;
  let recycledM3 = 0;
  let entriesWithWater = 0;

  for (const entry of entries) {
    if (entry.calculationResult) {
      scope1 += entry.calculationResult.totalDirectCo2eAr5;
      scope2 += entry.calculationResult.indirectElectricityCo2e + entry.calculationResult.indirectSteamCo2e;
    }
    productionQuantityT += entry.productionQuantityT ?? 0;

    // Electricity is already MWh; imported steam is GJ and converts at 3.6.
    energyMwh += entry.gridElectricityMwh + entry.renewableElectricityMwh + entry.steamImportedGj * GJ_TO_MWH;
    renewableMwh += entry.renewableElectricityMwh;

    if (entry.waterEntries.length > 0) {
      entriesWithWater += 1;
      const footprint = buildWaterFootprint(entry.waterEntries, entry.productionQuantityT);
      withdrawnM3 += footprint.totalWithdrawnM3;
      dischargedM3 += footprint.totalDischargedM3;
      // "Recycled and reused" maps to withdrawal from reclaimed sources —
      // total withdrawal less the freshwater portion.
      recycledM3 += footprint.totalWithdrawnM3 - footprint.freshwaterWithdrawnM3;
    }
  }

  const scope3 = scope3Rows.length
    ? round(scope3Rows.reduce((sum, r) => sum + r.calculatedEmissionsTco2e, 0), 2)
    : null;

  const wasteDiverted = griWaste
    ? (griWaste.hazardousDivertedReuseT ?? 0) +
      (griWaste.hazardousDivertedRecyclingT ?? 0) +
      (griWaste.hazardousDivertedOtherRecoveryT ?? 0) +
      (griWaste.nonHazardousDivertedReuseT ?? 0) +
      (griWaste.nonHazardousDivertedRecyclingT ?? 0) +
      (griWaste.nonHazardousDivertedOtherRecoveryT ?? 0)
    : null;
  const wasteDisposal = griWaste
    ? (griWaste.hazardousDisposalIncinerationWithRecoveryT ?? 0) +
      (griWaste.hazardousDisposalIncinerationNoRecoveryT ?? 0) +
      (griWaste.hazardousDisposalLandfillT ?? 0) +
      (griWaste.hazardousDisposalOtherT ?? 0) +
      (griWaste.nonHazardousDisposalIncinerationWithRecoveryT ?? 0) +
      (griWaste.nonHazardousDisposalIncinerationNoRecoveryT ?? 0) +
      (griWaste.nonHazardousDisposalLandfillT ?? 0) +
      (griWaste.nonHazardousDisposalOtherT ?? 0)
    : null;
  const hazardousWaste = griWaste
    ? (griWaste.hazardousDivertedReuseT ?? 0) +
      (griWaste.hazardousDivertedRecyclingT ?? 0) +
      (griWaste.hazardousDivertedOtherRecoveryT ?? 0) +
      (griWaste.hazardousDisposalIncinerationWithRecoveryT ?? 0) +
      (griWaste.hazardousDisposalIncinerationNoRecoveryT ?? 0) +
      (griWaste.hazardousDisposalLandfillT ?? 0) +
      (griWaste.hazardousDisposalOtherT ?? 0)
    : null;

  return {
    scope1Tco2e: round(scope1, 2),
    scope2LocationTco2e: round(scope2, 2),
    scope3Tco2e: scope3,
    totalGhgTco2e: round(scope1 + scope2 + (scope3 ?? 0), 2),
    totalEnergyMwh: round(energyMwh, 3),
    renewableEnergyMwh: round(renewableMwh, 3),
    waterWithdrawalM3: round(withdrawnM3, 3),
    waterDischargeM3: round(dischargedM3, 3),
    // Consumption is derived, never stored — the rule WaterEntry already sets.
    waterConsumptionM3: round(withdrawnM3 - dischargedM3, 3),
    waterRecycledM3: round(recycledM3, 3),
    hasWaterData: entriesWithWater > 0,
    wasteGeneratedTonnes:
      wasteDiverted != null && wasteDisposal != null ? round(wasteDiverted + wasteDisposal, 3) : null,
    wasteDivertedTonnes: wasteDiverted != null ? round(wasteDiverted, 3) : null,
    wasteDisposalTonnes: wasteDisposal != null ? round(wasteDisposal, 3) : null,
    hazardousWasteTonnes: hazardousWaste != null ? round(hazardousWaste, 3) : null,
    carbonCreditsCancelledTco2e: offsets.length
      ? round(offsets.reduce((sum, o) => sum + o.tonnageTco2e, 0), 2)
      : null,
    productionQuantityT: round(productionQuantityT, 3),
    activityDataCount: entries.length,
  };
};

export const computeIntensities = (
  rollup: Pick<CsrdMetricsRollup, "totalEnergyMwh" | "totalGhgTco2e" | "waterConsumptionM3">,
  netRevenueEur: number | null,
): CsrdIntensities => {
  const per = (numerator: number) =>
    netRevenueEur != null && netRevenueEur > 0 ? round(numerator / netRevenueEur, 10) : null;
  return {
    energyPerRevenue: per(rollup.totalEnergyMwh),
    ghgPerRevenue: per(rollup.totalGhgTco2e),
    waterPerRevenue: per(rollup.waterConsumptionM3),
  };
};

// ---------------------------------------------------------------------------
// Conformity evaluation
// ---------------------------------------------------------------------------

export interface CsrdStandardCompleteness {
  standardCode: string;
  label: string;
  title: string;
  isMaterial: boolean;
  /** ESRS 2's minimum disclosure requirements, restated per material standard. */
  minimumDisclosuresComplete: boolean;
  missingMinimumDisclosures: string[];
  datapointsReported: number;
  datapointsTotal: number;
  hasAnyData: boolean;
}

export interface CsrdConformityEvaluation {
  /** True only when everything below is satisfied AND the registry is reconciled. */
  conformant: boolean;
  /**
   * Separated from the customer's own gaps: the registry not yet being
   * reconciled with the adopted ESRS (2026) text is our problem, not theirs,
   * and a preparer must be able to tell the two apart.
   */
  registryReconciled: boolean;
  confirmedDatapoints: number;
  totalDatapoints: number;
  generalDisclosuresReported: number;
  generalDisclosuresTotal: number;
  missingGeneralDisclosures: string[];
  materialityAssessmentComplete: boolean;
  materialStandardCount: number;
  unexplainedExclusions: string[];
  standards: CsrdStandardCompleteness[];
  /** What the preparer can act on. */
  blockers: string[];
}

const hasValue = (v: unknown): boolean => v !== null && v !== undefined && v !== "";

export const isDatapointReported = (row: Record<string, unknown> | null | undefined, field: string): boolean =>
  row ? hasValue(row[field]) : false;

const MINIMUM_DISCLOSURES: { field: keyof CsrdMaterialTopic; label: string }[] = [
  { field: "policies", label: "Policies (MDR-P)" },
  { field: "actions", label: "Actions (MDR-A)" },
  { field: "targets", label: "Targets (MDR-T)" },
  { field: "metrics", label: "Metrics (MDR-M)" },
];

/**
 * Decides whether this statement may describe itself as ESRS-conformant.
 *
 * Deliberately stricter than GRI's equivalent in one respect: conformity is
 * refused outright while any registry datapoint is still PENDING_SOURCE,
 * regardless of how complete the customer's entry is. A statement claiming
 * conformity with a standard whose text we have not reconciled would be a
 * false compliance claim made by the platform rather than by the preparer,
 * which is the one kind this module must not be capable of producing.
 */
export const evaluateConformity = (input: {
  general: Record<string, unknown> | null;
  materialityCompletedAt: Date | null;
  materialTopics: CsrdMaterialTopic[];
  standardRows: Record<string, Record<string, unknown> | null>;
}): CsrdConformityEvaluation => {
  const blockers: string[] = [];

  if (!ESRS_REGISTRY_RECONCILED) {
    blockers.push(
      `ESRS datapoint definitions are not yet reconciled with the adopted ESRS (2026) delegated act ` +
        `(${ESRS_CONFIRMED_DATAPOINT_COUNT} of ${ESRS_TOTAL_DATAPOINT_COUNT} confirmed) — this statement cannot claim ESRS conformity`,
    );
  }

  const storedGeneral = ESRS_2_DATAPOINTS.filter((d) => !d.derived);
  const missingGeneralDisclosures = storedGeneral
    .filter((d) => !isDatapointReported(input.general, d.field))
    .map((d) => d.code);
  if (missingGeneralDisclosures.length > 0) {
    blockers.push(
      `${missingGeneralDisclosures.length} of ${storedGeneral.length} ESRS 2 general disclosures not yet reported (${missingGeneralDisclosures.slice(0, 6).join(", ")}${missingGeneralDisclosures.length > 6 ? ", ..." : ""})`,
    );
  }

  const materialityAssessmentComplete = input.materialityCompletedAt != null;
  if (!materialityAssessmentComplete) {
    blockers.push("Double materiality assessment has not been completed");
  }

  const materialRecords = input.materialTopics.filter((t) => t.isMaterial);
  const unexplainedExclusions = input.materialTopics
    .filter((t) => !t.isMaterial && !hasValue(t.notMaterialRationale))
    .map((t) => t.standardCode);
  if (unexplainedExclusions.length > 0) {
    blockers.push(
      `${unexplainedExclusions.length} standard${unexplainedExclusions.length === 1 ? "" : "s"} assessed as not material without a stated rationale`,
    );
  }

  const standards: CsrdStandardCompleteness[] = ESRS_STANDARDS.map((standard) => {
    const record = input.materialTopics.find((t) => t.standardCode === standard.code);
    const isMaterial = record?.isMaterial ?? false;
    const row = input.standardRows[standard.code] ?? null;

    const missingMinimumDisclosures = record
      ? MINIMUM_DISCLOSURES.filter((m) => !hasValue(record[m.field])).map((m) => m.label)
      : MINIMUM_DISCLOSURES.map((m) => m.label);

    const stored = standard.datapoints.filter((d) => !d.derived);
    const datapointsReported = stored.filter((d) => isDatapointReported(row, d.field)).length;

    return {
      standardCode: standard.code,
      label: standard.label,
      title: standard.title,
      isMaterial,
      minimumDisclosuresComplete: isMaterial && missingMinimumDisclosures.length === 0,
      missingMinimumDisclosures,
      datapointsReported,
      datapointsTotal: stored.length,
      hasAnyData: datapointsReported > 0,
    };
  });

  for (const standard of standards) {
    if (!standard.isMaterial) continue;
    if (!standard.minimumDisclosuresComplete) {
      blockers.push(
        `${standard.label} ${standard.title}: minimum disclosure requirements incomplete (${standard.missingMinimumDisclosures.join(", ")})`,
      );
    }
    if (!standard.hasAnyData) {
      blockers.push(`${standard.label} ${standard.title} is material but has no datapoints reported`);
    }
  }

  return {
    conformant: blockers.length === 0,
    registryReconciled: ESRS_REGISTRY_RECONCILED,
    confirmedDatapoints: ESRS_CONFIRMED_DATAPOINT_COUNT,
    totalDatapoints: ESRS_TOTAL_DATAPOINT_COUNT,
    generalDisclosuresReported: storedGeneral.length - missingGeneralDisclosures.length,
    generalDisclosuresTotal: storedGeneral.length,
    missingGeneralDisclosures,
    materialityAssessmentComplete,
    materialStandardCount: materialRecords.length,
    unexplainedExclusions,
    standards,
    blockers,
  };
};

// ---------------------------------------------------------------------------
// Assembled metrics
// ---------------------------------------------------------------------------

export const CSRD_REPORT_INCLUDE = {
  materialityAssessment: { include: { iros: true } },
  materialTopics: true,
  generalDisclosures: true,
  climateDisclosure: true,
  pollutionDisclosure: true,
  waterDisclosure: true,
  biodiversityDisclosure: true,
  circularDisclosure: true,
  ownWorkforceDisclosure: true,
  valueChainWorkersDisclosure: true,
  communitiesDisclosure: true,
  consumersDisclosure: true,
  businessConductDisclosure: true,
} satisfies Prisma.CsrdReportInclude;

export type CsrdReportWithRelations = Prisma.CsrdReportGetPayload<{ include: typeof CSRD_REPORT_INCLUDE }>;

/** Maps a standard code to its loaded disclosure row via the registry's `relation` name. */
export const standardRowsFrom = (
  report: CsrdReportWithRelations,
): Record<string, Record<string, unknown> | null> => {
  const rows: Record<string, Record<string, unknown> | null> = {};
  for (const standard of ESRS_STANDARDS) {
    rows[standard.code] =
      ((report as unknown as Record<string, unknown>)[standard.relation] as Record<string, unknown> | null) ?? null;
  }
  return rows;
};

export interface CsrdMetrics {
  fyWindow: CsrdFyWindow;
  rollup: CsrdMetricsRollup;
  intensities: CsrdIntensities;
  scores: CsrdStandardScore[];
  conformity: CsrdConformityEvaluation;
}

export const buildCsrdMetrics = async (
  report: CsrdReportWithRelations,
  facility: Pick<Facility, "id">,
  company: Pick<Company, "reportingFyStartMonth">,
): Promise<CsrdMetrics> => {
  const fyWindow = resolveFyWindow(report.reportingPeriod, company.reportingFyStartMonth);
  const rollup = await rollupCsrdMetrics(facility.id, report.reportingPeriod, fyWindow);

  const impactThreshold = report.materialityAssessment?.impactThreshold ?? 3;
  const financialThreshold = report.materialityAssessment?.financialThreshold ?? 3;

  return {
    fyWindow,
    rollup,
    intensities: computeIntensities(rollup, report.netRevenueEur),
    scores: rankStandardsByIros(report.materialityAssessment?.iros ?? [], impactThreshold, financialThreshold),
    conformity: evaluateConformity({
      general: report.generalDisclosures as unknown as Record<string, unknown> | null,
      materialityCompletedAt: report.materialityAssessment?.completedAt ?? null,
      materialTopics: report.materialTopics,
      standardRows: standardRowsFrom(report),
    }),
  };
};

/** Resolves a standard code to its human label for error messages. */
export const standardLabel = (code: string): string => {
  const standard = getEsrsStandard(code);
  return standard ? `${standard.label} ${standard.title}` : code;
};
