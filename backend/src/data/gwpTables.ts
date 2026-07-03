/**
 * 100-year Global Warming Potential tables.
 *
 * AR2/BUR3 — IPCC Second Assessment Report GWPs, as gazetted for India's
 * Carbon Credit Trading Scheme under S.O. 2825(E) (2023) and used in India's
 * Third Biennial Update Report (BUR3). This is a hard regulatory requirement
 * for CCTS calculations — do not substitute AR4 or AR5 values here, even
 * though later IPCC assessment reports are commonly used elsewhere.
 *
 * AR5 — IPCC Fifth Assessment Report GWPs (fossil CH4). These are the values
 * mandated by the EU CBAM Implementing Regulation (2023/1773, Annex III) for
 * converting non-CO2 gases to CO2e.
 *
 * CO2, CH4 and N2O are modelled for both schemes. CF4 and C2F6 (from
 * aluminium smelter anode effects — see the ALUMINIUM sector's PFC emission
 * calculation) are recorded on both tables and ARE multiplied into the
 * aluminium calculation: CBAM uses the AR5 values (6630 / 11100), CCTS uses
 * the AR2/BUR3-gazetted values (6500 / 9200) per S.O. 2825(E).
 */

export type GwpScheme = "AR2_BUR3" | "AR5";

export interface GwpTable {
  scheme: GwpScheme;
  label: string;
  source: string;
  co2: number;
  ch4: number;
  n2o: number;
  cf4?: number;
  c2f6?: number;
}

export const GWP_AR2_BUR3: GwpTable = {
  scheme: "AR2_BUR3",
  label: "IPCC AR2 / BUR3 (100-yr)",
  source: "IPCC Second Assessment Report, as gazetted for CCTS under S.O. 2825(E) 2023 and India's Third Biennial Update Report (BUR3)",
  co2: 1,
  ch4: 21,
  n2o: 310,
  cf4: 6500,
  c2f6: 9200,
};

export const GWP_AR5: GwpTable = {
  scheme: "AR5",
  label: "IPCC AR5 (100-yr)",
  source: "IPCC Fifth Assessment Report — mandated by EU CBAM Implementing Regulation 2023/1773 Annex III",
  co2: 1,
  ch4: 28,
  n2o: 265,
  cf4: 6630,
  c2f6: 11100,
};

export const GWP_TABLES: Record<GwpScheme, GwpTable> = {
  AR2_BUR3: GWP_AR2_BUR3,
  AR5: GWP_AR5,
};
