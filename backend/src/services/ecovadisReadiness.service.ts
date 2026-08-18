/**
 * EcoVadis readiness.
 *
 * ===========================================================================
 * THIS DOES NOT PREDICT AN ECOVADIS SCORE, AND CANNOT.
 *
 * EcoVadis scores 0-100 and awards medals using its own methodology, applied
 * by its analysts to the questionnaire and supporting documents a company
 * submits on its platform. The weighting differs by sector, company size and
 * country, the question set is issued per company, and the evidence is
 * assessed by a human. None of that is visible from here.
 *
 * So this maps data the company has ALREADY given us onto EcoVadis's four
 * themes and reports how much of each theme is covered. That is a preparation
 * aid: it tells a company what it would be able to evidence today and where it
 * would be starting from zero. It is not a score, not a medal, not a
 * prediction of either, and it is never expressed on a 0-100 scale — the same
 * discipline as CDP's readiness bands, and for the same reason.
 *
 * It is also not a submission route. EcoVadis assessments are completed on
 * EcoVadis's own platform.
 * ===========================================================================
 *
 * The four themes are EcoVadis's: Environment, Labour & Human Rights, Ethics,
 * and Sustainable Procurement. What sits under each here is this platform's
 * mapping of its own data, not EcoVadis's question set, which is issued per
 * company and which nobody here has.
 */

export type EcovadisThemeKey = "ENVIRONMENT" | "LABOUR_HUMAN_RIGHTS" | "ETHICS" | "SUSTAINABLE_PROCUREMENT";

export type ReadinessBand = "NOT_STARTED" | "DEVELOPING" | "ESTABLISHED" | "STRONG";

export interface ReadinessIndicator {
  key: string;
  label: string;
  /** Where the answer would come from, shown when it is missing. */
  sourcedFrom: string;
  met: boolean;
}

export interface EcovadisTheme {
  key: EcovadisThemeKey;
  label: string;
  band: ReadinessBand;
  metCount: number;
  totalCount: number;
  coveragePct: number;
  indicators: ReadinessIndicator[];
}

export interface EcovadisReadiness {
  themes: EcovadisTheme[];
  overallBand: ReadinessBand;
  metCount: number;
  totalCount: number;
  coveragePct: number;
  /** What to do next, worst-covered theme first. */
  gaps: string[];
  notScoreNotice: string;
  notSubmissionNotice: string;
}

/**
 * What the readiness map reads. Every field is something the platform already
 * holds — this module collects nothing new.
 */
export interface EcovadisInputs {
  hasScope12: boolean;
  hasScope3: boolean;
  hasEnergySplit: boolean;
  hasRenewableProcurement: boolean;
  hasWaterData: boolean;
  hasWasteData: boolean;
  hasEmissionsTarget: boolean;

  hasEmployeeHeadcount: boolean;
  hasGenderDiversity: boolean;
  hasSafetyIncidents: boolean;
  hasHumanRightsPolicy: boolean;
  hasCollectiveBargaining: boolean;

  hasCodeOfConduct: boolean;
  hasAntiCorruption: boolean;
  hasWhistleblowing: boolean;
  hasConflictsOfInterest: boolean;
  hasBoardOversight: boolean;

  hasSupplierList: boolean;
  hasSupplierDisclosures: boolean;
  hasSupplierScreening: boolean;
  hasSupplierRiskAssessment: boolean;
}

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Bands from coverage. Same thresholds as the CDP readiness indicator, so a
 * customer reading both does not have to hold two scales in mind.
 */
const bandFor = (met: number, total: number): ReadinessBand => {
  if (total === 0 || met === 0) return "NOT_STARTED";
  const ratio = met / total;
  if (ratio >= 0.85) return "STRONG";
  if (ratio >= 0.5) return "ESTABLISHED";
  return "DEVELOPING";
};

const THEME_DEFINITIONS: {
  key: EcovadisThemeKey;
  label: string;
  indicators: { key: string; label: string; sourcedFrom: string; read: (i: EcovadisInputs) => boolean }[];
}[] = [
  {
    key: "ENVIRONMENT",
    label: "Environment",
    indicators: [
      { key: "scope12", label: "Scope 1 and 2 emissions measured", sourcedFrom: "Activity data", read: (i) => i.hasScope12 },
      { key: "scope3", label: "Scope 3 emissions measured", sourcedFrom: "Scope 3 module", read: (i) => i.hasScope3 },
      { key: "energySplit", label: "Renewable / non-renewable energy split", sourcedFrom: "BRSR Core or activity data", read: (i) => i.hasEnergySplit },
      { key: "renewableProcurement", label: "Renewable procurement evidence", sourcedFrom: "REC ledger", read: (i) => i.hasRenewableProcurement },
      { key: "water", label: "Water withdrawal and discharge", sourcedFrom: "ISO 14046 water inventory", read: (i) => i.hasWaterData },
      { key: "waste", label: "Waste generated and diverted", sourcedFrom: "GRI 306 or BRSR Core", read: (i) => i.hasWasteData },
      { key: "target", label: "Emissions reduction target", sourcedFrom: "Targets", read: (i) => i.hasEmissionsTarget },
    ],
  },
  {
    key: "LABOUR_HUMAN_RIGHTS",
    label: "Labour & Human Rights",
    indicators: [
      { key: "headcount", label: "Employee headcount and composition", sourcedFrom: "GRI 2-7 or BRSR Core", read: (i) => i.hasEmployeeHeadcount },
      { key: "diversity", label: "Gender diversity", sourcedFrom: "BRSR Core", read: (i) => i.hasGenderDiversity },
      { key: "safety", label: "Health and safety incidents", sourcedFrom: "BRSR Core", read: (i) => i.hasSafetyIncidents },
      { key: "humanRights", label: "Human rights policy commitment", sourcedFrom: "GRI 2-23", read: (i) => i.hasHumanRightsPolicy },
      { key: "collectiveBargaining", label: "Collective bargaining coverage", sourcedFrom: "GRI 2-30", read: (i) => i.hasCollectiveBargaining },
    ],
  },
  {
    key: "ETHICS",
    label: "Ethics",
    indicators: [
      { key: "codeOfConduct", label: "Code of conduct", sourcedFrom: "ESRS G1-1", read: (i) => i.hasCodeOfConduct },
      { key: "antiCorruption", label: "Anti-corruption programme", sourcedFrom: "ESRS G1-3", read: (i) => i.hasAntiCorruption },
      { key: "whistleblowing", label: "Whistleblowing mechanism", sourcedFrom: "GRI 2-16 / 2-26", read: (i) => i.hasWhistleblowing },
      { key: "conflicts", label: "Conflicts of interest process", sourcedFrom: "GRI 2-15", read: (i) => i.hasConflictsOfInterest },
      { key: "boardOversight", label: "Board oversight of sustainability", sourcedFrom: "ESRS GOV-1 / CDP C1", read: (i) => i.hasBoardOversight },
    ],
  },
  {
    key: "SUSTAINABLE_PROCUREMENT",
    label: "Sustainable Procurement",
    indicators: [
      { key: "supplierList", label: "Key suppliers identified", sourcedFrom: "Supplier scorecard", read: (i) => i.hasSupplierList },
      { key: "supplierDisclosures", label: "Supplier ESG disclosures held", sourcedFrom: "Supplier scorecard", read: (i) => i.hasSupplierDisclosures },
      { key: "screening", label: "Supplier screening on ESG criteria", sourcedFrom: "GRI 308 / 414", read: (i) => i.hasSupplierScreening },
      { key: "riskAssessment", label: "Supplier risk assessment", sourcedFrom: "Supplier scorecard", read: (i) => i.hasSupplierRiskAssessment },
    ],
  },
];

export const buildEcovadisReadiness = (inputs: EcovadisInputs): EcovadisReadiness => {
  const themes: EcovadisTheme[] = THEME_DEFINITIONS.map((definition) => {
    const indicators = definition.indicators.map((indicator) => ({
      key: indicator.key,
      label: indicator.label,
      sourcedFrom: indicator.sourcedFrom,
      met: indicator.read(inputs),
    }));
    const metCount = indicators.filter((i) => i.met).length;
    return {
      key: definition.key,
      label: definition.label,
      band: bandFor(metCount, indicators.length),
      metCount,
      totalCount: indicators.length,
      coveragePct: round((metCount / indicators.length) * 100),
      indicators,
    };
  });

  const metCount = themes.reduce((sum, t) => sum + t.metCount, 0);
  const totalCount = themes.reduce((sum, t) => sum + t.totalCount, 0);

  // The overall band cannot exceed the weakest theme. EcoVadis assesses all
  // four, so strong environmental data with nothing on ethics is not a
  // well-prepared position — averaging would hide exactly that.
  const bandOrder: ReadinessBand[] = ["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"];
  const overallFromCoverage = bandFor(metCount, totalCount);
  const weakest = themes.reduce(
    (lowest, t) => (bandOrder.indexOf(t.band) < bandOrder.indexOf(lowest) ? t.band : lowest),
    overallFromCoverage,
  );

  const gaps = themes
    .slice()
    .sort((a, b) => a.coveragePct - b.coveragePct)
    .filter((t) => t.metCount < t.totalCount)
    .map((t) => {
      const missing = t.indicators.filter((i) => !i.met);
      return `${t.label}: ${missing.length} of ${t.totalCount} not covered — ${missing
        .slice(0, 3)
        .map((m) => m.label.toLowerCase())
        .join(", ")}${missing.length > 3 ? ", and others" : ""}.`;
    });

  return {
    themes,
    overallBand: weakest,
    metCount,
    totalCount,
    coveragePct: round((metCount / totalCount) * 100),
    gaps,
    notScoreNotice: ECOVADIS_NOT_A_SCORE_NOTICE,
    notSubmissionNotice: ECOVADIS_NOT_A_SUBMISSION_NOTICE,
  };
};

export const ECOVADIS_NOT_A_SCORE_NOTICE =
  "This is not an EcoVadis score and does not predict one. EcoVadis scores 0-100 and awards medals using its own " +
  "methodology, weighted by sector, size and country, applied by its analysts to the questionnaire and documents " +
  "you submit. None of that is visible from here. This shows how much of each theme you could already evidence " +
  "from data you have given us, and where you would be starting from nothing.";

export const ECOVADIS_NOT_A_SUBMISSION_NOTICE =
  "Preparation only — EcoVadis assessments are completed on EcoVadis's own platform, and nothing here is sent to " +
  "them. The themes below are EcoVadis's four; what sits under each is our mapping of your data, not EcoVadis's " +
  "question set, which is issued per company.";

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = {
  NOT_STARTED: "Not started",
  DEVELOPING: "Developing",
  ESTABLISHED: "Established",
  STRONG: "Strong",
};
