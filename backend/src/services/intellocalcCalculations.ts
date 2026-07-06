import {
  BORDER_SEE_VALUES,
  CBAM_CERTIFICATE_PRICE_EUR,
  CBAM_CERTIFICATE_PRICE_QUARTER,
  DE_MINIMIS_THRESHOLD_TONNES,
  EUR_TO_INR_RATE,
  FUEL_EMISSION_FACTORS,
  GRID_EMISSION_FACTOR,
  INDIA_REFERENCE_INTENSITY,
  borderSeeKey,
  type IndiaSector,
} from "../data/intellocalcConstants";
import type { BorderInputs, ComplyInputs, IndiaInputs } from "../validators/leadCapture.validators";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// IntelloCalc Border — CBAM Liability Estimator
// ---------------------------------------------------------------------------

export interface BorderResults {
  seeValue: number;
  totalEmbeddedEmissionsTco2e: number;
  certificatesRequired: number;
  cbamLiabilityEur: number;
  cbamLiabilityInr: number;
  article9DeductionEur?: number;
  netLiabilityEur?: number;
  deMinimisWarning: boolean;
  certificatePriceEur: number;
  certificatePriceQuarter: string;
  eurToInrRate: number;
}

export const calculateBorder = (inputs: BorderInputs): BorderResults => {
  const seeKey = borderSeeKey(inputs.sector, inputs.productionRoute);
  const seeValue = BORDER_SEE_VALUES[seeKey];

  const totalEmbeddedEmissionsTco2e = seeValue * inputs.euExportQuantityTonnes;
  const certificatesRequired = totalEmbeddedEmissionsTco2e;
  const cbamLiabilityEur = certificatesRequired * CBAM_CERTIFICATE_PRICE_EUR;
  const cbamLiabilityInr = cbamLiabilityEur * EUR_TO_INR_RATE;

  let article9DeductionEur: number | undefined;
  let netLiabilityEur: number | undefined;
  if (inputs.carbonPricePaidInrPerTonne !== undefined && inputs.carbonPricePaidInrPerTonne > 0) {
    article9DeductionEur =
      (inputs.carbonPricePaidInrPerTonne / EUR_TO_INR_RATE) * inputs.euExportQuantityTonnes;
    netLiabilityEur = cbamLiabilityEur - article9DeductionEur;
  }

  return {
    seeValue,
    totalEmbeddedEmissionsTco2e: round2(totalEmbeddedEmissionsTco2e),
    certificatesRequired: round2(certificatesRequired),
    cbamLiabilityEur: round2(cbamLiabilityEur),
    cbamLiabilityInr: round2(cbamLiabilityInr),
    article9DeductionEur: article9DeductionEur !== undefined ? round2(article9DeductionEur) : undefined,
    netLiabilityEur: netLiabilityEur !== undefined ? round2(netLiabilityEur) : undefined,
    deMinimisWarning: inputs.euExportQuantityTonnes < DE_MINIMIS_THRESHOLD_TONNES,
    certificatePriceEur: CBAM_CERTIFICATE_PRICE_EUR,
    certificatePriceQuarter: CBAM_CERTIFICATE_PRICE_QUARTER,
    eurToInrRate: EUR_TO_INR_RATE,
  };
};

// ---------------------------------------------------------------------------
// IntelloCalc India — CCTS GHG Intensity Checker
// ---------------------------------------------------------------------------

export type IndiaPosition = "SURPLUS_LIKELY" | "NEAR_TARGET" | "DEFICIT_LIKELY" | "NO_REFERENCE";

export interface IndiaResults {
  ghgIntensity: number;
  referenceIntensity: number | null;
  position: IndiaPosition;
  estimatedCccImpact: number | null;
  directEmissionsTco2e: number;
  indirectEmissionsTco2e: number;
  totalEmissionsTco2e: number;
}

export const calculateIndia = (inputs: IndiaInputs): IndiaResults => {
  const fuelEf = FUEL_EMISSION_FACTORS[inputs.fuelTypeMix];
  const directEmissionsTco2e = inputs.totalFuelConsumptionGj * fuelEf;
  const indirectEmissionsTco2e = inputs.totalElectricityMwh * GRID_EMISSION_FACTOR;
  const totalEmissionsTco2e = directEmissionsTco2e + indirectEmissionsTco2e;
  const ghgIntensity = totalEmissionsTco2e / inputs.annualProductionTonnes;

  const referenceIntensity = INDIA_REFERENCE_INTENSITY[inputs.sector as IndiaSector] ?? null;

  let position: IndiaPosition = "NO_REFERENCE";
  let estimatedCccImpact: number | null = null;

  if (referenceIntensity !== null) {
    const diffPct = (ghgIntensity - referenceIntensity) / referenceIntensity;
    if (diffPct < -0.05) position = "SURPLUS_LIKELY";
    else if (diffPct <= 0.05) position = "NEAR_TARGET";
    else position = "DEFICIT_LIKELY";

    estimatedCccImpact = round2(Math.abs(referenceIntensity - ghgIntensity) * inputs.annualProductionTonnes);
  }

  return {
    ghgIntensity: round2(ghgIntensity),
    referenceIntensity,
    position,
    estimatedCccImpact,
    directEmissionsTco2e: round2(directEmissionsTco2e),
    indirectEmissionsTco2e: round2(indirectEmissionsTco2e),
    totalEmissionsTco2e: round2(totalEmissionsTco2e),
  };
};

// ---------------------------------------------------------------------------
// IntelloCalc Comply — Compliance Eligibility Checker
// ---------------------------------------------------------------------------

export interface ComplyFramework {
  key: string;
  name: string;
  status: "MANDATORY" | "RECOMMENDED";
  deadline: string;
  whatWeDo: string;
}

export interface ComplyResults {
  nonManufacturer: boolean;
  cbamApplicable: boolean;
  cbamDeMinimisNote: boolean;
  cctsApplicable: boolean;
  combinedNote: boolean;
  frameworks: ComplyFramework[];
  noneApplicable: boolean;
}

const EPR_FRAMEWORKS: Record<string, ComplyFramework> = {
  BATTERIES: {
    key: "BATTERIES",
    name: "Battery EPR",
    status: "MANDATORY",
    deadline: "Battery Waste Management Rules, 2022",
    whatWeDo: "Intellocarbon tracks your Extended Producer Responsibility obligations and filing cycle.",
  },
  PLASTIC: {
    key: "PLASTIC",
    name: "Plastic EPR",
    status: "MANDATORY",
    deadline: "Plastic Waste Management Rules, 2016",
    whatWeDo: "Intellocarbon tracks your Extended Producer Responsibility obligations and filing cycle.",
  },
  EEE: {
    key: "EEE",
    name: "E-Waste EPR",
    status: "MANDATORY",
    deadline: "E-Waste Management Rules, 2022",
    whatWeDo: "Intellocarbon tracks your Extended Producer Responsibility obligations and filing cycle.",
  },
  TYRES: {
    key: "TYRES",
    name: "Tyre EPR",
    status: "MANDATORY",
    deadline: "Hazardous Waste Rules Amendment, 2022",
    whatWeDo: "Intellocarbon tracks your Extended Producer Responsibility obligations and filing cycle.",
  },
  LUBRICATING_OILS: {
    key: "LUBRICATING_OILS",
    name: "Used Oil EPR",
    status: "MANDATORY",
    deadline: "Hazardous Waste Rules Amendment, 2023",
    whatWeDo: "Intellocarbon tracks your Extended Producer Responsibility obligations and filing cycle.",
  },
};

export const calculateComply = (inputs: ComplyInputs): ComplyResults => {
  if (!inputs.manufacturesGoods) {
    return {
      nonManufacturer: true,
      cbamApplicable: false,
      cbamDeMinimisNote: false,
      cctsApplicable: false,
      combinedNote: false,
      frameworks: [],
      noneApplicable: false,
    };
  }

  const selectedEuGoods = inputs.euGoods.filter((g) => g !== "NONE");
  const cbamApplicable =
    (inputs.exportsToEu === "YES" || inputs.exportsToEu === "PLANNING") && selectedEuGoods.length > 0;
  const cbamDeMinimisNote = cbamApplicable && inputs.euExportVolume === "BELOW_50";

  const cctsApplicable = inputs.cctsStatus === "NOTIFIED" || inputs.cctsStatus === "MAYBE";

  const frameworks: ComplyFramework[] = [];

  if (cbamApplicable) {
    frameworks.push({
      key: "CBAM",
      name: "EU Carbon Border Adjustment Mechanism",
      status: "MANDATORY",
      deadline: "Q2 2026 quarterly report due 31 October 2026",
      whatWeDo: "Intellocarbon generates your CBAM Communication Package and verification report.",
    });
  }

  if (cctsApplicable) {
    frameworks.push({
      key: "CCTS",
      name: "India Carbon Credit Trading Scheme",
      status: "MANDATORY",
      deadline: "Q3 2026 monitoring period active now",
      whatWeDo: "Intellocarbon calculates your GHG intensity, generates BEE Forms 1 A/B/C/D, and tracks your CCC position.",
    });
  }

  const combinedNote = cbamApplicable && cctsApplicable;

  const selectedEpr = inputs.eprProducts.filter((p) => p !== "NONE");
  for (const product of selectedEpr) {
    const framework = EPR_FRAMEWORKS[product];
    if (framework) frameworks.push(framework);
  }

  return {
    nonManufacturer: false,
    cbamApplicable,
    cbamDeMinimisNote,
    cctsApplicable,
    combinedNote,
    frameworks,
    noneApplicable: frameworks.length === 0,
  };
};
