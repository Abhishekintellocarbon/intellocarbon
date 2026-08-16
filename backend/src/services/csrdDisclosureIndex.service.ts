import {
  ESRS_2_DATAPOINTS,
  ESRS_STANDARDS,
  ESRS_REGISTRY_RECONCILED,
  ESRS_CONFIRMED_DATAPOINT_COUNT,
  ESRS_TOTAL_DATAPOINT_COUNT,
  CSRD_CLAIM_STATEMENTS,
  CSRD_OMISSION_REASON_LABELS,
  CSRD_APPLICABILITY_NOTICE,
  getEsrsStandard,
  type CsrdClaimLevel,
  type CsrdOmissionReason,
  type EsrsDatapointStatus,
} from "../data/esrsStandards";
import {
  isDatapointReported,
  standardRowsFrom,
  type CsrdMetrics,
  type CsrdReportWithRelations,
} from "./csrdCalculation.service";

/**
 * The ESRS disclosure index.
 *
 * ESRS 2 IRO-2 requires the statement to list the disclosure requirements it
 * covers, and ESRS 1 requires omissions to be explained rather than left
 * blank. This is that list — the CSRD counterpart to the GRI content index,
 * with one addition GRI has no equivalent for: a reconciliation column
 * recording whether each datapoint's definition has actually been checked
 * against the adopted ESRS (2026) text.
 *
 * That column is the honesty mechanism for this whole module. Until the
 * registry is populated from the delegated act annex, the index prints
 * "unreconciled" against every datapoint and the report carries the weaker
 * "prepared with reference" claim, no matter how complete the data entry is.
 */

export interface CsrdDisclosureIndexEntry {
  /** e.g. "ESRS E1: Climate change". Blank on continuation rows within a standard. */
  standard: string;
  /** Official datapoint reference, e.g. "E1-6". */
  code: string;
  label: string;
  /** 1-based page in the generated PDF, stamped during rendering. */
  pageNumber: number | null;
  reported: boolean;
  omissionReason: CsrdOmissionReason | null;
  /** Named ESRS transitional relief, where the datapoint has one. */
  phaseIn: string | null;
  /** True when the figure came from the platform's engines rather than manual entry. */
  derived: boolean;
  /** Whether this datapoint's definition has been reconciled with ESRS (2026). */
  status: EsrsDatapointStatus;
  section: "GENERAL" | "STANDARD";
  standardCode: string | null;
}

export interface CsrdDisclosureIndex {
  entries: CsrdDisclosureIndexEntry[];
  claimLevel: CsrdClaimLevel;
  claimStatement: string;
  applicabilityNotice: string;
  /** Datapoint definitions reconciled against the adopted delegated act. */
  registryReconciled: boolean;
  confirmedDatapoints: number;
  totalDatapoints: number;
  reportedCount: number;
  omittedCount: number;
  phaseInCount: number;
  excludedStandards: { standard: string; title: string; rationale: string }[];
}

/**
 * Chooses the omission reason for an unreported datapoint.
 *
 * Ordering matters. A datapoint under a standard that was assessed as not
 * material is NOT_MATERIAL — that is a determination the undertaking made and
 * defended, not a gap. A datapoint carrying a named transitional relief is
 * PHASE_IN_RELIEF, which a reader can check against the standard. Only what is
 * left is DATA_UNAVAILABLE. Reaching for DATA_UNAVAILABLE first would report
 * deliberate, defensible omissions as failures to collect data.
 *
 * CONFIDENTIALITY is never assigned automatically: it asserts something about
 * the undertaking's circumstances that the platform has no basis to claim on
 * its behalf.
 */
const omissionFor = (opts: { standardMaterial: boolean; phaseIn?: string }): CsrdOmissionReason => {
  if (!opts.standardMaterial) return "NOT_MATERIAL";
  if (opts.phaseIn) return "PHASE_IN_RELIEF";
  return "DATA_UNAVAILABLE";
};

export const buildDisclosureIndex = (
  report: CsrdReportWithRelations,
  metrics: CsrdMetrics,
): CsrdDisclosureIndex => {
  const entries: CsrdDisclosureIndexEntry[] = [];
  const general = report.generalDisclosures as unknown as Record<string, unknown> | null;
  const standardRows = standardRowsFrom(report);

  // --- ESRS 2, always listed in full ---
  ESRS_2_DATAPOINTS.forEach((dp, index) => {
    // Derived datapoints have no stored column; IRO-2 is generated from this
    // very index, so it counts as reported whenever the index exists.
    const reported = dp.derived ? true : isDatapointReported(general, dp.field);
    entries.push({
      standard: index === 0 ? "ESRS 2: General disclosures" : "",
      code: dp.code,
      label: dp.label,
      pageNumber: null,
      reported,
      omissionReason: reported ? null : omissionFor({ standardMaterial: true, phaseIn: dp.phaseIn }),
      phaseIn: dp.phaseIn ?? null,
      derived: dp.derived ?? false,
      status: dp.status,
      section: "GENERAL",
      standardCode: null,
    });
  });

  // --- Topical standards ---
  for (const standard of ESRS_STANDARDS) {
    const record = report.materialTopics.find((t) => t.standardCode === standard.code);
    const isMaterial = record?.isMaterial ?? false;
    // A standard assessed as not material is listed separately with its
    // rationale, not as a wall of omitted datapoints.
    if (!isMaterial) continue;

    const row = standardRows[standard.code];

    standard.datapoints.forEach((dp, index) => {
      const reported = dp.derived
        ? derivedDatapointHasValue(dp.field, metrics)
        : isDatapointReported(row, dp.field);
      entries.push({
        standard: index === 0 ? `${standard.label}: ${standard.title}` : "",
        code: dp.code,
        label: dp.label,
        pageNumber: null,
        reported,
        omissionReason: reported ? null : omissionFor({ standardMaterial: true, phaseIn: dp.phaseIn }),
        phaseIn: dp.phaseIn ?? null,
        derived: dp.derived ?? false,
        status: dp.status,
        section: "STANDARD",
        standardCode: standard.code,
      });
    });
  }

  const excludedStandards = report.materialTopics
    .filter((t) => !t.isMaterial)
    .map((t) => {
      const standard = getEsrsStandard(t.standardCode);
      return {
        standard: standard ? `${standard.label}: ${standard.title}` : t.standardCode,
        title: standard?.title ?? t.standardCode,
        rationale: t.notMaterialRationale ?? "No rationale stated.",
      };
    })
    .sort((a, b) => a.standard.localeCompare(b.standard));

  const claimLevel: CsrdClaimLevel = metrics.conformity.conformant
    ? "ESRS_CONFORMANT"
    : "PREPARED_WITH_REFERENCE";

  return {
    entries,
    claimLevel,
    claimStatement: CSRD_CLAIM_STATEMENTS[claimLevel],
    applicabilityNotice: CSRD_APPLICABILITY_NOTICE,
    registryReconciled: ESRS_REGISTRY_RECONCILED,
    confirmedDatapoints: ESRS_CONFIRMED_DATAPOINT_COUNT,
    totalDatapoints: ESRS_TOTAL_DATAPOINT_COUNT,
    reportedCount: entries.filter((e) => e.reported).length,
    omittedCount: entries.filter((e) => !e.reported).length,
    phaseInCount: entries.filter((e) => !e.reported && e.omissionReason === "PHASE_IN_RELIEF").length,
    excludedStandards,
  };
};

/**
 * Whether a derived datapoint actually resolved to a value.
 *
 * Derived datapoints have no stored column, so "reported" means the
 * calculation produced something — a facility with no water inventory has not
 * reported E3-4 just because the field is computed. Mapped explicitly rather
 * than by naming convention so a renamed rollup field fails loudly here
 * instead of silently reporting every derived datapoint as present.
 */
const derivedDatapointHasValue = (field: string, metrics: CsrdMetrics): boolean => {
  const r = metrics.rollup;
  const i = metrics.intensities;
  switch (field) {
    case "totalEnergyConsumptionMwh":
      return r.totalEnergyMwh > 0;
    case "energyRenewableMwh":
      return r.renewableEnergyMwh > 0;
    case "energyIntensityPerRevenue":
      return i.energyPerRevenue != null;
    case "scope1Tco2e":
      return r.scope1Tco2e > 0;
    case "scope2LocationTco2e":
      return r.scope2LocationTco2e > 0;
    case "scope3Tco2e":
      return r.scope3Tco2e != null;
    case "totalGhgTco2e":
      return r.totalGhgTco2e > 0;
    case "ghgIntensityPerRevenue":
      return i.ghgPerRevenue != null;
    case "carbonCreditsCancelledTco2e":
      return r.carbonCreditsCancelledTco2e != null;
    case "waterConsumptionM3":
    case "waterWithdrawalM3":
    case "waterDischargeM3":
    case "waterRecycledM3":
      return r.hasWaterData;
    case "waterIntensityPerRevenue":
      return i.waterPerRevenue != null;
    case "wasteGeneratedTonnes":
      return r.wasteGeneratedTonnes != null;
    case "wasteDivertedTonnes":
      return r.wasteDivertedTonnes != null;
    case "wasteDisposalTonnes":
      return r.wasteDisposalTonnes != null;
    case "hazardousWasteTonnes":
      return r.hazardousWasteTonnes != null;
    case "disclosureRequirementsCovered":
      // IRO-2 is this index. If it exists, the requirement is met.
      return true;
    default:
      return false;
  }
};

/**
 * Stamps page numbers once the PDF builder knows where each section landed.
 * Keys are "GENERAL" or a standard code — page granularity is per section,
 * which is what a disclosure index means by a page reference.
 */
export const assignPageNumbers = (index: CsrdDisclosureIndex, pages: Record<string, number>): void => {
  for (const entry of index.entries) {
    const key = entry.section === "STANDARD" ? entry.standardCode : entry.section;
    if (key && pages[key] != null) entry.pageNumber = pages[key];
  }
};

export const formatOmission = (entry: CsrdDisclosureIndexEntry): string =>
  entry.reported || !entry.omissionReason ? "" : CSRD_OMISSION_REASON_LABELS[entry.omissionReason];
