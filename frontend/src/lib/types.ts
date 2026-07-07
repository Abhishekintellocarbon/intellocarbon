export type Sector = "STEEL" | "CEMENT" | "ALUMINIUM" | "FERTILIZER" | "HYDROGEN" | "ELECTRICITY" | "OTHER";
export type FacilityType =
  | "INTEGRATED_STEEL_PLANT"
  | "EAF_MINI_MILL"
  | "DRI_PLANT"
  | "ROLLING_MILL"
  | "PELLET_PLANT"
  | "CEMENT_PLANT"
  | "ALUMINIUM_SMELTER"
  | "FERTILIZER_PLANT"
  | "HYDROGEN_PLANT"
  | "POWER_PLANT"
  | "OTHER";
/** Free-text route key, validated against SECTOR_PRODUCTION_ROUTES for the company's sector — not a fixed union. */
export type ProductionRoute = string;
export type HydrogenRoute = "SMR" | "SMR_CCS" | "ELECTROLYSIS_GRID" | "ELECTROLYSIS_RENEWABLE" | "BIOMASS";

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
  euImporterName: string | null;
  euImporterEori: string | null;
  euImporterCountry: string | null;
  euImporterContactEmail: string | null;
  euImporterContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { facilities: number };
}

export interface Facility {
  id: string;
  companyId: string;
  name: string;
  // Null until the facility's autosaved draft has these fields filled in —
  // both are required (and validated against the sector) before isDraft
  // can flip to false.
  facilityType: FacilityType | null;
  productionRoute: ProductionRoute | null;
  address: string | null;
  state: string | null;
  district: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  installedCapacityTpa: number | null;
  commissioningYear: number | null;
  productsManufactured: string[];
  cnCodes: string[];
  isDraft: boolean;
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
  scheme: "AR2_BUR3" | "AR5";
  label: string;
  source: string;
  co2: number;
  ch4: number;
  n2o: number;
  cf4?: number;
  c2f6?: number;
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
  calcination?: {
    limestoneInputTonnes: number;
    emissionFactorUsed: number;
    clinkerConversionFraction: number;
    co2Tonnes: number;
  };
  fertilizerFeedstock?: {
    naturalGasFeedstockNm3: number;
    emissionFactorUsed: number;
    co2Tonnes: number;
  };
  pfc?: {
    cf4Tonnes: number;
    c2f6Tonnes: number;
    anodeEffectMinutes: number | null;
    co2eAr5: number;
    co2eAr4: number;
    gwpAr5: { cf4?: number; c2f6?: number };
    gwpAr4: { cf4?: number; c2f6?: number };
  };
  n2oProcess?: {
    n2oTonnes: number;
    abatementFactorPct: number;
    netN2oTonnes: number;
    co2eAr5: number;
    co2eAr4: number;
  };
  hydrogen?: {
    route: HydrogenRoute;
    ccsCaptureRatePct: number | null;
    hydrogenPurityPct: number | null;
    byproductOxygenTonnes: number | null;
  };
  electricitySector?: {
    electricityGeneratedMwh: number | null;
    electricityExportedEuMwh: number | null;
    ownUseElectricityMwh: number | null;
    lineLossMwh: number | null;
  };
  sector: Sector;
  seeUnit: string;
  gwpTables: { ar4: GwpTable; ar5: GwpTable };
}

export interface EmissionCalculationResult {
  id: string;
  activityDataId: string;
  directCombustionCo2eAr5: number;
  directCombustionCo2eAr4: number;
  directProcessCo2e: number;
  directPrecursorCo2e: number;
  directPfcCo2eAr5: number;
  directPfcCo2eAr4: number;
  directN2oProcessCo2eAr5: number;
  directN2oProcessCo2eAr4: number;
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

export interface ActivityData {
  id: string;
  facilityId: string;
  sector: Sector;
  // Null until the autosaved draft has these fields filled in — all four
  // are required before status can flip from DRAFT to SUBMITTED.
  periodStart: string | null;
  periodEnd: string | null;
  productCategory: string | null;
  productionQuantityT: number | null;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
  gridEmissionFactorOverride: number | null;
  steamImportedGj: number;
  steamEmissionFactorOverride: number | null;
  limestoneInputTonnes: number | null;
  clinkerProducedTonnes: number | null;
  clinkerConversionFraction: number | null;
  cf4EmissionsTonnes: number | null;
  c2f6EmissionsTonnes: number | null;
  anodeEffectMinutes: number | null;
  n2oProcessEmissionsTonnes: number | null;
  n2oAbatementFactorPct: number | null;
  naturalGasFeedstockNm3: number | null;
  hydrogenRoute: HydrogenRoute | null;
  ccsCaptureRatePct: number | null;
  hydrogenPurityPct: number | null;
  byproductOxygenTonnes: number | null;
  electricityGeneratedMwh: number | null;
  electricityExportedEuMwh: number | null;
  ownUseElectricityMwh: number | null;
  lineLossMwh: number | null;
  carbonPricePaidEurPerTonne: number | null;
  cctsTargetIntensity: number | null;
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

// BRSR Core's GHG attribute (1 of 9) isn't stored here — it's derived from the
// facility's existing ActivityData/EmissionCalculationResult rows, see BrsrCoreMetrics.
export interface BrsrCoreReport {
  id: string;
  companyId: string;
  facilityId: string;
  reportingPeriod: string;
  turnoverInr: number | null;
  waterWithdrawnKl: number | null;
  waterDischargedKl: number | null;
  wasteGeneratedTonnes: number | null;
  wasteRecoveredTonnes: number | null;
  renewableEnergyConsumptionGj: number | null;
  nonRenewableEnergyConsumptionGj: number | null;
  employeeCountTotal: number | null;
  employeeCountFemale: number | null;
  wagesPaidMaleInr: number | null;
  wagesPaidFemaleInr: number | null;
  safetyIncidentsCount: number | null;
  womenInWorkforcePct: number | null;
  womenInManagementPct: number | null;
  procurementFromMsmePct: number | null;
  purchasesFromTop10SuppliersPct: number | null;
  salesToTop10CustomersPct: number | null;
  consumerComplaintsCount: number | null;
  consumerComplaintsResolvedPct: number | null;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrsrCoreMetrics {
  fyWindow: { start: string; end: string; label: string };
  turnoverInr: number | null;
  ghg: {
    scope1Co2e: number;
    scope2Co2e: number;
    totalCo2e: number;
    productionQuantityT: number;
    intensityPerRupeeTurnover: number | null;
    intensityPerUnitProduction: number | null;
    activityDataCount: number;
  };
  water: {
    withdrawnKl: number | null;
    dischargedKl: number | null;
    consumptionKl: number | null;
    intensityPerRupeeTurnover: number | null;
  };
  waste: {
    generatedTonnes: number | null;
    recoveredTonnes: number | null;
    recoveryRatePct: number | null;
    intensityPerRupeeTurnover: number | null;
  };
  energy: {
    renewableGj: number | null;
    nonRenewableGj: number | null;
    totalGj: number | null;
    renewablePct: number | null;
    electricityAndSteamGjReused: number;
  };
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
  sectors: Sector[];
}

export interface ProcessMaterialDefinition {
  key: string;
  label: string;
  efCo2PerTonne: number;
  sectors: Sector[];
}

export interface PrecursorDefinition {
  key: string;
  label: string;
  defaultEmbeddedFactor: number;
  sectors: Sector[];
}

export interface EuDefaultSeeReference {
  valueTco2ePerTonne: number;
  source: string;
}

export interface CnCodeReference {
  code: string;
  label: string;
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
    hydrogenRoute: ReferenceOption[];
  };
  sectorFacilityTypes: Record<Sector, FacilityType[]>;
  sectorProductionRoutes: Record<Sector, ReferenceOption[]>;
  cnCodesBySector: Record<Sector, CnCodeReference[]>;
  fertilizerProductOptions: ReferenceOption[];
  euDefaultSee: {
    steel: Record<string, EuDefaultSeeReference>;
    cement: EuDefaultSeeReference;
    aluminium: EuDefaultSeeReference;
    hydrogen: EuDefaultSeeReference;
    fertilizer: Record<string, EuDefaultSeeReference>;
  };
  n2oDefaultEf: { tonnesPerTonneNitricAcid: number; source: string };
  cementCalcinationEmissionFactor: number;
}

export type SubscriptionTier =
  | "CCTS_COMPLIANCE"
  | "CBAM_COMPLIANCE"
  | "CBAM_PLUS_CCTS"
  | "BRSR_CORE_REPORTING";
export type SubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  forWhom: string;
  facilityLimit: number | null;
  priceInr: number | null;
  priceLabel: string;
  description: string;
  features: string[];
  highlight?: boolean;
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
  accreditationNumber: string | null;
  statement: string | null;
  comments: string | null;
  submittedAt: string;
  decidedAt: string | null;
}

export interface VerificationRequestDetail extends VerificationRequest {
  activityData: ActivityData & { facility: Facility & { company: Company } };
}

export type NotificationType = "MONTHLY_REMINDER" | "DEADLINE_WARNING_30D" | "DEADLINE_URGENT_7D";

export interface Notification {
  id: string;
  companyId: string;
  facilityId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ReportWindowStatus {
  cbam: { open: boolean; unlockDate: string; deadlineDate: string };
  ccts: { open: boolean; unlockDate: string; deadlineDate: string };
  brsr: { fyLabel: string; deadlineDate: string };
}

// --- Report generation (dashboard "Generate Report" modal) ---
// Mirrors backend/src/services/reportGeneration.service.ts.

export type GeneratedReportType = "CBAM" | "CCTS" | "BRSR";

export interface ReportPeriodStatus {
  period: string;
  displayLabel: string;
  isOpen: boolean;
  windowStart: string;
  windowEnd: string;
  dataRangeStart?: string;
  dataRangeEnd?: string;
}

export interface ReportCardStatus {
  reportType: GeneratedReportType;
  hasAccess: boolean;
  period: ReportPeriodStatus;
  existingReport: { id: string; generatedAt: string; pdfPath: string } | null;
}

export interface ReportGenerationStatus {
  hasAnySubscription: boolean;
  cards: ReportCardStatus[];
}

export interface GeneratedReport {
  id: string;
  facilityId: string;
  companyId: string;
  reportType: GeneratedReportType;
  period: string;
  generatedAt: string;
  pdfPath: string;
  status: "GENERATED";
  document?: { id: string; verified: boolean; fileName: string } | null;
}

// --- Facility dashboard (/facilities/[id]/dashboard) ---
// Mirrors backend/src/services/facilityDashboard.service.ts — that service owns
// all EU-default/GWP/certificate-price business logic, this page only renders
// the numbers it's handed.

export type CctsTone = "SURPLUS" | "ON_TRACK" | "DEFICIT" | "NO_TARGET";

export interface FacilityDashboardCbam {
  hasData: boolean;
  actualSee?: number;
  defaultSee?: number;
  seeUnit?: string;
  isBetterThanDefault?: boolean;
  liabilityEur?: number;
  certificatePrice?: number;
  certificatePriceQuarter?: string;
  periodLabel?: string;
}

export interface FacilityDashboardCcts {
  hasData: boolean;
  actualIntensity?: number;
  targetIntensity?: number | null;
  tone?: CctsTone;
  deltaTco2e?: number | null;
  periodLabel?: string;
}

export interface FacilityDashboardBrsr {
  fyLabel: string;
  status: "SUBMITTED" | "DRAFT" | "NOT_STARTED";
  attributesFilled: number;
  attributesTotal: number;
}

export interface FacilityDashboardDeadline {
  deadline: string;
  daysRemaining: number;
}

export interface FacilityDashboardEmissionsBreakdown {
  hasData: boolean;
  periodLabel?: string;
  totalTco2e?: number;
  segments?: { label: string; valueTco2e: number; pct: number }[];
}

export interface FacilityLiabilityTrendPoint {
  quarterLabel: string;
  actualLiabilityEur: number;
  defaultLiabilityEur: number;
}

export interface FacilityIntensityTrendPoint {
  periodLabel: string;
  periodEnd: string;
  actualIntensity: number;
  targetIntensity: number | null;
  aboveTarget: boolean | null;
}

export interface FacilityActivityFeedItem {
  id: string;
  kind: "SUBMISSION" | "REPORT" | "VERIFICATION" | "ALERT";
  label: string;
  detail: string;
  timestamp: string;
}

export interface FacilityDashboard {
  facility: { id: string; name: string; sector: Sector; productionRoute: string | null };
  cbam: FacilityDashboardCbam;
  ccts: FacilityDashboardCcts;
  brsr: FacilityDashboardBrsr;
  deadlines: {
    cbam: FacilityDashboardDeadline;
    ccts: FacilityDashboardDeadline;
    brsr: FacilityDashboardDeadline;
  };
  emissionsBreakdown: FacilityDashboardEmissionsBreakdown;
  liabilityTrend: FacilityLiabilityTrendPoint[];
  intensityTrend: FacilityIntensityTrendPoint[];
  intensityTargetLine: number | null;
  recentActivity: FacilityActivityFeedItem[];
}
