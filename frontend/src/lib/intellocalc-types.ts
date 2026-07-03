export type BorderSector = "IRON_STEEL" | "CEMENT" | "ALUMINIUM" | "FERTILIZERS" | "HYDROGEN" | "ELECTRICITY";
export type BorderProductionRoute = "EAF" | "BF_BOF";

export interface BorderInputs {
  sector: BorderSector;
  productionRoute?: BorderProductionRoute;
  annualProductionTonnes: number;
  euExportQuantityTonnes: number;
  carbonPricePaidInrPerTonne?: number;
}

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
  eurToInrRate: number;
}

export type IndiaSector =
  | "ALUMINIUM"
  | "CEMENT"
  | "IRON_STEEL"
  | "CHLOR_ALKALI"
  | "FERTILIZER"
  | "PAPER_PULP"
  | "PETROCHEMICAL"
  | "PETROLEUM_REFINERY"
  | "TEXTILE";

export type FuelTypeMix = "COAL" | "NATURAL_GAS" | "MIXED" | "OTHER";

export interface IndiaInputs {
  sector: IndiaSector;
  annualProductionTonnes: number;
  totalFuelConsumptionGj: number;
  totalElectricityMwh: number;
  fuelTypeMix: FuelTypeMix;
  baselineIntensity?: number;
}

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

export type CbamGood = "IRON_STEEL" | "CEMENT" | "ALUMINIUM" | "FERTILIZERS" | "HYDROGEN" | "ELECTRICITY" | "NONE";
export type EprProduct = "BATTERIES" | "PLASTIC" | "EEE" | "TYRES" | "LUBRICATING_OILS" | "NONE";

export interface ComplyInputs {
  manufacturesGoods: boolean;
  exportsToEu: "YES" | "NO" | "PLANNING";
  euGoods: CbamGood[];
  euExportVolume?: "BELOW_50" | "RANGE_50_500" | "RANGE_500_5000" | "ABOVE_5000";
  cctsStatus: "NOTIFIED" | "MAYBE" | "NOT_COVERED" | "NOT_SURE";
  eprProducts: EprProduct[];
}

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

export interface LeadContact {
  name: string;
  email: string;
  company: string;
  phone?: string;
}

export interface LeadCapture {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  toolUsed: "BORDER" | "INDIA" | "COMPLY";
  inputsJson: unknown;
  resultsJson: unknown;
  followedUp: boolean;
  createdAt: string;
}
