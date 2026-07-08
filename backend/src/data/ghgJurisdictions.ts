/**
 * GHG Runner jurisdiction registry — the single source of truth for which
 * GWP table and reporting-standard labelling a manual GHG Protocol
 * engagement uses. Deliberately a flat, self-contained Record keyed by
 * `GhgJurisdiction` (see prisma/schema.prisma) so adding a jurisdiction, or
 * moving one to a newer IPCC assessment report, is a single new/edited
 * entry here — never touches the calculation engine or the report builder.
 *
 * Hard rule: an engagement's GWP table is fixed by its jurisdiction and
 * applied uniformly to every Scope 1 entry — never mix GWP tables within
 * one engagement. See ghgCalculation.service.ts.
 */

export type GhgJurisdictionKey = "US_CALIFORNIA" | "UK" | "AUSTRALIA" | "UAE_MIDDLE_EAST" | "EU" | "OTHER_GHG_PROTOCOL";

export type GwpAssessmentReport = "AR5" | "AR6";

export interface JurisdictionGwpSet {
  scheme: GwpAssessmentReport;
  /** 100-yr GWP, fossil CO2 — always 1 by definition, kept explicit for the report table. */
  co2: number;
  /** 100-yr GWP, fossil CH4. */
  ch4: number;
  /** 100-yr GWP, N2O. */
  n2o: number;
}

export interface JurisdictionConfig {
  key: GhgJurisdictionKey;
  label: string;
  /** The specific disclosure regulation/standard this jurisdiction maps to — shown on the report cover and methodology page. */
  regulationLabel: string;
  gwp: JurisdictionGwpSet;
  /** IPCC assessment report citation for the GWP values above — required on every report per the platform's no-assumed-values rule. */
  gwpSource: string;
}

const AR6_FOSSIL_GWP: JurisdictionGwpSet = { scheme: "AR6", co2: 1, ch4: 27.9, n2o: 273 };
const AR5_FOSSIL_GWP: JurisdictionGwpSet = { scheme: "AR5", co2: 1, ch4: 28, n2o: 265 };

const AR6_SOURCE =
  "IPCC Sixth Assessment Report (AR6), Working Group I — Chapter 7, Table 7.15 (100-yr GWP, fossil methane)";
const AR5_SOURCE = "IPCC Fifth Assessment Report (AR5), Working Group I — Chapter 8, Table 8.A.1 (100-yr GWP)";

export const GHG_JURISDICTIONS: Record<GhgJurisdictionKey, JurisdictionConfig> = {
  US_CALIFORNIA: {
    key: "US_CALIFORNIA",
    label: "United States — California",
    regulationLabel: "California SB 253 — Climate Corporate Data Accountability Act",
    gwp: AR6_FOSSIL_GWP,
    gwpSource: AR6_SOURCE,
  },
  UK: {
    key: "UK",
    label: "United Kingdom",
    regulationLabel: "UK SECR / UK Sustainability Reporting Standards (UK SRS)",
    gwp: AR5_FOSSIL_GWP,
    gwpSource: AR5_SOURCE,
  },
  AUSTRALIA: {
    key: "AUSTRALIA",
    label: "Australia",
    regulationLabel: "Australian Sustainability Reporting Standards (ASRS)",
    gwp: AR6_FOSSIL_GWP,
    gwpSource: AR6_SOURCE,
  },
  UAE_MIDDLE_EAST: {
    key: "UAE_MIDDLE_EAST",
    label: "UAE / Middle East",
    regulationLabel: "GHG Protocol Corporate Standard (voluntary / regional disclosure)",
    gwp: AR5_FOSSIL_GWP,
    gwpSource: AR5_SOURCE,
  },
  EU: {
    key: "EU",
    label: "European Union",
    regulationLabel: "EU CSRD — ESRS E1 (Climate Change) datapoints",
    gwp: AR5_FOSSIL_GWP,
    gwpSource: AR5_SOURCE,
  },
  OTHER_GHG_PROTOCOL: {
    key: "OTHER_GHG_PROTOCOL",
    label: "Other — GHG Protocol Corporate Standard",
    regulationLabel: "GHG Protocol Corporate Accounting and Reporting Standard",
    gwp: AR5_FOSSIL_GWP,
    gwpSource: AR5_SOURCE,
  },
};

export const GHG_JURISDICTION_OPTIONS: JurisdictionConfig[] = Object.values(GHG_JURISDICTIONS);
