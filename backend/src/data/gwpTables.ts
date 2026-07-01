/**
 * 100-year Global Warming Potential tables.
 *
 * AR4 — IPCC Fourth Assessment Report GWPs. Used historically by India's GHG
 * accounting frameworks (PAT scheme / India GHG Programme) that this platform's
 * CCTS calculations follow.
 *
 * AR5 — IPCC Fifth Assessment Report GWPs (fossil CH4). These are the values
 * mandated by the EU CBAM Implementing Regulation (2023/1773, Annex III) for
 * converting non-CO2 gases to CO2e.
 *
 * Only CO2, CH4 and N2O are modelled — the gases relevant to steel-sector
 * combustion and process emissions covered by this module.
 */

export type GwpScheme = "AR4" | "AR5";

export interface GwpTable {
  scheme: GwpScheme;
  label: string;
  source: string;
  co2: number;
  ch4: number;
  n2o: number;
}

export const GWP_AR4: GwpTable = {
  scheme: "AR4",
  label: "IPCC AR4 (100-yr)",
  source: "IPCC Fourth Assessment Report — used for CCTS / India GHG Programme calculations",
  co2: 1,
  ch4: 25,
  n2o: 298,
};

export const GWP_AR5: GwpTable = {
  scheme: "AR5",
  label: "IPCC AR5 (100-yr)",
  source: "IPCC Fifth Assessment Report — mandated by EU CBAM Implementing Regulation 2023/1773 Annex III",
  co2: 1,
  ch4: 28,
  n2o: 265,
};

export const GWP_TABLES: Record<GwpScheme, GwpTable> = {
  AR4: GWP_AR4,
  AR5: GWP_AR5,
};
