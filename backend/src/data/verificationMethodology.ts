/**
 * Formula and source-citation text shown alongside the calculation engine
 * output in the verifier portal — reuses the same numbers
 * cbamFinancialImpact.service.ts already computes, this just documents how
 * each one is derived so a verifier can check it without reading the source
 * code. Sources match the ones already cited in cbamReferenceData.ts and
 * emissionFactors.ts.
 */

export interface MethodologyNote {
  formula: string;
  source: string;
}

export const CALCULATION_METHODOLOGY: Record<"see" | "cbamLiability" | "cctsIntensity" | "article9", MethodologyNote> = {
  see: {
    formula:
      "SEE = (Direct combustion CO2e + Direct process CO2e + Precursor embedded CO2e) ÷ Production quantity (t), using AR5 GWP for CH4/N2O — or per MWh exported for the Electricity sector.",
    source:
      "Default fuel/process emission factors: IPCC 2006 Guidelines for National GHG Inventories, Vol 2 (Tables 1.2, 2.2). AR5 GWP: IPCC Fifth Assessment Report. Any line item flagged as an override uses the company-provided factor instead of the default.",
  },
  cbamLiability: {
    formula: "Estimated liability (EUR) = Total embedded emissions (tCO2e, AR5 basis) × CBAM certificate reference price (EUR/tCO2e).",
    source:
      "European Commission quarterly CBAM certificate reference price, published under Regulation (EU) 2023/956 Article 21 — see cbamReferenceData.ts for the current figure and publication date.",
  },
  cctsIntensity: {
    formula:
      "GHG Intensity = (Direct combustion CO2e + Direct process CO2e + Precursor embedded CO2e + Indirect electricity/steam CO2e) ÷ Production quantity (t), using AR2/BUR3 GWP.",
    source:
      "S.O. 2825(E) 2023 (India CCTS scheme notification) — GWP values per BUR3 (India's Third Biennial Update Report), mandated for CCTS reporting in place of AR4/AR5.",
  },
  article9: {
    formula:
      "Article 9 deduction (tCO2e) = min(Certificates required, (Carbon price effectively paid in the country of origin × Production quantity) ÷ CBAM certificate price).",
    source: "Regulation (EU) 2023/956 Article 9 — deduction for a carbon price effectively paid in the country of origin.",
  },
};
