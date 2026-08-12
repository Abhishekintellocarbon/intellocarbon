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

/**
 * The UK CBAM counterparts, kept as their own record rather than added to
 * CALCULATION_METHODOLOGY above: a verifier reading a UK figure needs to see
 * the UK boundary and the UK rate mechanism, and interleaving them with the
 * EU notes would invite checking one regime's number against the other's
 * formula.
 */
export const UK_CBAM_METHODOLOGY: Record<"emissions" | "liability" | "overseasCarbonPrice", MethodologyNote> = {
  emissions: {
    formula:
      "UK CBAM emissions (tCO2e) = Direct combustion CO2e + Direct process CO2e + PFC CO2e + Process N2O CO2e + Precursor embedded CO2e, using AR5 GWP. Indirect emissions (purchased electricity, imported steam) are excluded.",
    source:
      "UK Government Policy Paper, November 2025 — UK CBAM emissions scope. Scope 1 and select precursor emissions are in scope from the 1 January 2027 launch; indirect emissions are deferred to 2029 at the earliest.",
  },
  liability: {
    formula: "Gross liability (GBP) = UK CBAM emissions (tCO2e) × UK CBAM rate (GBP/tCO2e).",
    source:
      "The UK CBAM rate is set quarterly by HMRC from the UK ETS auction price plus Carbon Price Support. Where no rate has been published for the accounting period, no liability is stated.",
  },
  overseasCarbonPrice: {
    formula:
      "Adjustment (tCO2e) = min(UK CBAM emissions, (Carbon price paid overseas × UK CBAM emissions) ÷ UK CBAM rate). Capped at the gross liability, so it can never produce a negative liability.",
    source:
      "Recorded per activity data entry in GBP/tCO2e. No currency conversion is performed — an overseas price entered against the EU regime in EUR is not reused here.",
  },
};
