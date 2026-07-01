export type Sector = "STEEL" | "CEMENT" | "ALUMINIUM" | "FERTILIZER" | "HYDROGEN" | "ELECTRICITY" | "OTHER";
export type FacilityType =
  | "INTEGRATED_STEEL_PLANT"
  | "EAF_MINI_MILL"
  | "DRI_PLANT"
  | "ROLLING_MILL"
  | "PELLET_PLANT"
  | "OTHER";
export type ProductionRoute = "BF_BOF" | "EAF" | "DRI_EAF" | "OTHER";

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  registrationNumber: string | null;
  sector: Sector;
  subSector: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  annualTurnoverInr: number | null;
  employeeCount: number | null;
  reportingFyStartMonth: number;
  appliesCbam: boolean;
  appliesCcts: boolean;
  isPatDesignatedConsumer: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { facilities: number };
}

export interface Facility {
  id: string;
  companyId: string;
  name: string;
  facilityType: FacilityType;
  productionRoute: ProductionRoute;
  address: string | null;
  state: string | null;
  district: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  installedCapacityTpa: number | null;
  commissioningYear: number | null;
  productsManufactured: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { activityData: number };
}

export interface FuelEntry {
  id: string;
  fuelType: string;
  quantity: number;
  unit: string;
  emissionFactorOverrideCo2: number | null;
}

export interface ProcessMaterialEntry {
  id: string;
  materialType: string;
  quantityTonnes: number;
  emissionFactorOverride: number | null;
}

export interface PrecursorEntry {
  id: string;
  materialType: string;
  quantityTonnes: number;
  embeddedEmissionFactorOverride: number | null;
  sourceLabel: string | null;
}

export interface GwpTable {
  scheme: "AR4" | "AR5";
  label: string;
  source: string;
  co2: number;
  ch4: number;
  n2o: number;
}

export interface EmissionBreakdownLine {
  [key: string]: unknown;
}

export interface EmissionBreakdown {
  fuels: (EmissionBreakdownLine & {
    fuelType: string;
    label: string;
    quantity: number;
    unit: string;
    co2Tonnes: number;
    ch4Kg: number;
    n2oKg: number;
    co2eAr5: number;
    co2eAr4: number;
  })[];
  processMaterials: (EmissionBreakdownLine & {
    materialType: string;
    label: string;
    quantityTonnes: number;
    emissionFactorUsed: number;
    isOverride: boolean;
    co2Tonnes: number;
  })[];
  precursors: (EmissionBreakdownLine & {
    materialType: string;
    label: string;
    quantityTonnes: number;
    emissionFactorUsed: number;
    isOverride: boolean;
    co2eTonnes: number;
  })[];
  electricity: {
    gridMwh: number;
    renewableMwh: number;
    emissionFactorUsed: number;
    isOverride: boolean;
    co2eTonnes: number;
  };
  steam: {
    gj: number;
    emissionFactorUsed: number;
    isOverride: boolean;
    co2eTonnes: number;
  };
  gwpTables: { ar4: GwpTable; ar5: GwpTable };
}

export interface EmissionCalculationResult {
  id: string;
  activityDataId: string;
  directCombustionCo2eAr5: number;
  directCombustionCo2eAr4: number;
  directProcessCo2e: number;
  directPrecursorCo2e: number;
  indirectElectricityCo2e: number;
  indirectSteamCo2e: number;
  totalDirectCo2eAr5: number;
  totalDirectCo2eAr4: number;
  totalEmissionsCbamAr5: number;
  totalEmissionsCctsAr4: number;
  specificEmbeddedEmissionsCbam: number;
  ghgIntensityCcts: number;
  gridEmissionFactorUsed: number;
  breakdown: EmissionBreakdown;
  calculatedAt: string;
}

export interface SteelActivityData {
  id: string;
  facilityId: string;
  periodStart: string;
  periodEnd: string;
  productCategory: string;
  productionQuantityT: number;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
  gridEmissionFactorOverride: number | null;
  steamImportedGj: number;
  steamEmissionFactorOverride: number | null;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  fuelEntries: FuelEntry[];
  processMaterialEntries: ProcessMaterialEntry[];
  precursorEntries: PrecursorEntry[];
  calculationResult: EmissionCalculationResult | null;
  verificationRequest?: VerificationRequest | null;
  facility?: Facility;
}

export interface ReferenceOption {
  value: string;
  label: string;
}

export interface FuelDefinition {
  key: string;
  label: string;
  unit: string;
  efCo2PerUnit: number;
  efCh4PerUnit: number;
  efN2oPerUnit: number;
}

export interface ProcessMaterialDefinition {
  key: string;
  label: string;
  efCo2PerTonne: number;
}

export interface PrecursorDefinition {
  key: string;
  label: string;
  defaultEmbeddedFactor: number;
}

export interface EmissionFactorReference {
  fuels: FuelDefinition[];
  processMaterials: ProcessMaterialDefinition[];
  precursors: PrecursorDefinition[];
  defaultGridEmissionFactor: number;
  defaultSteamEmissionFactor: number;
  gwpTables: { ar4: GwpTable; ar5: GwpTable };
  enums: {
    sector: ReferenceOption[];
    facilityType: ReferenceOption[];
    productionRoute: ReferenceOption[];
  };
}

export type SubscriptionTier = "STARTER" | "GROWTH" | "ENTERPRISE";
export type SubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  facilityLimit: number | null;
  priceInr: number | null;
  priceLabel: string;
  description: string;
  features: string[];
}

export interface Subscription {
  id: string;
  companyId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutResult {
  devBypass: boolean;
  razorpayKeyId?: string;
  razorpaySubscriptionId?: string;
  subscription: Subscription;
}

export type VerificationStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface VerificationRequest {
  id: string;
  activityDataId: string;
  companyId: string;
  status: VerificationStatus;
  verifierId: string | null;
  verifier: { id: string; name: string } | null;
  verifierOrg: string | null;
  statement: string | null;
  comments: string | null;
  submittedAt: string;
  decidedAt: string | null;
}

export interface VerificationRequestDetail extends VerificationRequest {
  activityData: SteelActivityData & { facility: Facility & { company: Company } };
}
