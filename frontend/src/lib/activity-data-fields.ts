import type { ActivityData, EmissionCalculationResult } from "./types";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Every activity_data input field worth showing in a read-only detail view (admin/verifier portals) — used to render "all field values" without a hardcoded form layout. */
export const ACTIVITY_DATA_FIELDS: { key: keyof ActivityData; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "periodStart", label: "Period Start" },
  { key: "periodEnd", label: "Period End" },
  { key: "productCategory", label: "Product Category" },
  { key: "productionQuantityT", label: "Production Quantity (t)" },
  { key: "gridElectricityMwh", label: "Grid Electricity (MWh)" },
  { key: "renewableElectricityMwh", label: "Renewable Electricity (MWh)" },
  { key: "gridEmissionFactorOverride", label: "Grid EF Override" },
  { key: "steamImportedGj", label: "Steam Imported (GJ)" },
  { key: "steamEmissionFactorOverride", label: "Steam EF Override" },
  { key: "limestoneInputTonnes", label: "Limestone Input (t)" },
  { key: "clinkerProducedTonnes", label: "Clinker Produced (t)" },
  { key: "clinkerConversionFraction", label: "Clinker Conversion Fraction" },
  { key: "cf4EmissionsTonnes", label: "CF4 Emissions (t)" },
  { key: "c2f6EmissionsTonnes", label: "C2F6 Emissions (t)" },
  { key: "anodeEffectMinutes", label: "Anode Effect (min)" },
  { key: "n2oProcessEmissionsTonnes", label: "N2O Process Emissions (t)" },
  { key: "n2oAbatementFactorPct", label: "N2O Abatement Factor (%)" },
  { key: "naturalGasFeedstockNm3", label: "Natural Gas Feedstock (Nm3)" },
  { key: "hydrogenRoute", label: "Hydrogen Route" },
  { key: "ccsCaptureRatePct", label: "CCS Capture Rate (%)" },
  { key: "hydrogenPurityPct", label: "Hydrogen Purity (%)" },
  { key: "byproductOxygenTonnes", label: "Byproduct Oxygen (t)" },
  { key: "electricityGeneratedMwh", label: "Electricity Generated (MWh)" },
  { key: "electricityExportedEuMwh", label: "Electricity Exported to EU (MWh)" },
  { key: "ownUseElectricityMwh", label: "Own-use Electricity (MWh)" },
  { key: "lineLossMwh", label: "Line Loss (MWh)" },
  { key: "carbonPricePaidEurPerTonne", label: "Carbon Price Paid (EUR/t)" },
  { key: "cctsTargetIntensity", label: "CCTS Target Intensity" },
  { key: "notes", label: "Notes" },
];

export const CALC_RESULT_FIELDS: { key: keyof EmissionCalculationResult; label: string }[] = [
  { key: "directCombustionCo2eAr5", label: "Direct Combustion CO2e (AR5)" },
  { key: "directCombustionCo2eAr4", label: "Direct Combustion CO2e (AR2/BUR3)" },
  { key: "directProcessCo2e", label: "Direct Process CO2e" },
  { key: "directPrecursorCo2e", label: "Direct Precursor CO2e" },
  { key: "directPfcCo2eAr5", label: "Direct PFC CO2e (AR5)" },
  { key: "directPfcCo2eAr4", label: "Direct PFC CO2e (AR2/BUR3)" },
  { key: "directN2oProcessCo2eAr5", label: "Direct N2O Process CO2e (AR5)" },
  { key: "directN2oProcessCo2eAr4", label: "Direct N2O Process CO2e (AR2/BUR3)" },
  { key: "indirectElectricityCo2e", label: "Indirect Electricity CO2e" },
  { key: "indirectSteamCo2e", label: "Indirect Steam CO2e" },
  { key: "totalDirectCo2eAr5", label: "Total Direct CO2e (AR5)" },
  { key: "totalDirectCo2eAr4", label: "Total Direct CO2e (AR2/BUR3)" },
  { key: "totalEmissionsCbamAr5", label: "Total Emissions — CBAM (AR5)" },
  { key: "totalEmissionsCctsAr4", label: "Total Emissions — CCTS (AR2/BUR3)" },
  { key: "specificEmbeddedEmissionsCbam", label: "Specific Embedded Emissions (CBAM)" },
  { key: "ghgIntensityCcts", label: "GHG Intensity (CCTS)" },
  { key: "gridEmissionFactorUsed", label: "Grid EF Used" },
];

export const formatFieldValue = (key: string, value: unknown): string => {
  if (value == null) return "—";
  if (key === "periodStart" || key === "periodEnd") return fmtDate(value as string);
  if (typeof value === "number") return value.toLocaleString("en-IN", { maximumFractionDigits: 4 });
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};
