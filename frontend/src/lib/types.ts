import type { LeadCapture } from "./intellocalc-types";

export type Sector = "STEEL" | "CEMENT" | "ALUMINIUM" | "FERTILIZER" | "HYDROGEN" | "ELECTRICITY" | "OTHER";

// Which border-carbon-adjustment regime applies. EU and UK CBAM are
// independent obligations — a company can be in scope for either, both, or
// neither — so Company carries a set, gated by appliesCbam.
export type CbamFramework = "EU_CBAM" | "UK_CBAM";
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
  gstin: string | null;
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
  // Empty whenever appliesCbam is false; the API guarantees the two agree.
  cbamFrameworks: CbamFramework[];
  appliesCcts: boolean;
  isPatDesignatedConsumer: boolean;
  // Scope 3 relevance drivers — see Scope3RelevanceResponse.
  ownershipModel: OwnershipModel;
  businessModel: BusinessModel;
  onboardingCompletedAt: string | null;
  euImporterName: string | null;
  euImporterEori: string | null;
  euImporterCountry: string | null;
  euImporterContactEmail: string | null;
  euImporterContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { facilities: number };
  /**
   * Whether the company holds the ESG Disclosure Bundle. Returned by
   * GET /api/company/me and used to decide whether to offer the optional
   * water inventory section — the authoritative gate stays server-side.
   */
  esgBundleActive?: boolean;
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
  /**
   * `ar4` is a stored key inside the persisted `breakdown` Json column, not a
   * live API field — it keeps the old spelling (the table it holds has always
   * been AR2/BUR3) so historical rows still parse. Same for every co2eAr4 /
   * gwpAr4 above. The DB-column-backed fields on EmissionCalculationResult
   * below were renamed to Ar2Bur3; these deliberately were not.
   */
  gwpTables: { ar4: GwpTable; ar5: GwpTable };
}

export interface EmissionCalculationResult {
  id: string;
  activityDataId: string;
  directCombustionCo2eAr5: number;
  directCombustionCo2eAr2Bur3: number;
  directProcessCo2e: number;
  directPrecursorCo2e: number;
  directPfcCo2eAr5: number;
  directPfcCo2eAr2Bur3: number;
  directN2oProcessCo2eAr5: number;
  directN2oProcessCo2eAr2Bur3: number;
  indirectElectricityCo2e: number;
  indirectSteamCo2e: number;
  totalDirectCo2eAr5: number;
  totalDirectCo2eAr2Bur3: number;
  totalEmissionsCbamAr5: number;
  totalEmissionsCctsAr2Bur3: number;
  specificEmbeddedEmissionsCbam: number;
  // UK CBAM counts a narrower boundary than the EU — Scope 1 + select
  // precursors, with indirect emissions deferred to 2029 — so these are
  // separate figures, always <= their EU counterparts for the same entry.
  totalEmissionsUkCbamAr5: number;
  specificEmbeddedEmissionsUkCbam: number;
  ghgIntensityCcts: number;
  gridEmissionFactorUsed: number;
  breakdown: EmissionBreakdown;
  calculatedAt: string;
}

/** One measured water source for a period — ISO 14046 inventory line. */
export interface WaterEntry {
  id: string;
  sourceType: string;
  withdrawnM3: number;
  dischargedM3: number;
  freshwaterFactorOverride: number | null;
}

export interface WaterSourceDefinition {
  key: string;
  label: string;
  category: "FRESHWATER" | "RECLAIMED";
  freshwaterFactor: number;
  source: string;
  description: string;
}

export interface WaterSourceBreakdownEntry {
  sourceType: string;
  label: string;
  category: string;
  withdrawnM3: number;
  dischargedM3: number;
  consumedM3: number;
  freshwaterWithdrawnM3: number;
  freshwaterFactorApplied: number;
  pctOfWithdrawal: number;
}

/**
 * Derived on read by the backend, never stored — see
 * waterCalculation.service.ts. Consumption is withdrawal minus discharge.
 */
export interface WaterFootprint {
  hasData: boolean;
  unit: string;
  totalWithdrawnM3: number;
  totalDischargedM3: number;
  totalConsumedM3: number;
  freshwaterWithdrawnM3: number;
  recycledSharePct: number;
  waterIntensityM3PerTonne: number | null;
  withdrawalIntensityM3PerTonne: number | null;
  sources: WaterSourceBreakdownEntry[];
  hasDischargeExceedingWithdrawal: boolean;
}

export interface WaterFootprintRollup extends WaterFootprint {
  entriesWithWater: number;
  facilitiesReporting: number;
}

export type OffsetRegistry = "VERRA" | "GOLD_STANDARD" | "ACR" | "CAR" | "ART" | "ICM" | "OTHER";
export type OffsetCategory =
  | "AVOIDANCE_NATURE"
  | "AVOIDANCE_ENGINEERED"
  | "REMOVAL_NATURE"
  | "REMOVAL_ENGINEERED";

/**
 * A logged voluntary carbon credit purchase. Tracking only — every field is
 * recorded as the purchaser entered it; nothing here is verified or rated.
 */
export interface VoluntaryOffsetPurchase {
  id: string;
  companyId: string;
  facilityId: string;
  registry: OffsetRegistry;
  creditSerialNumber: string;
  tonnageTco2e: number;
  category: OffsetCategory;
  vintageYear: number;
  purchaseDate: string;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OffsetTotals {
  /** SUBMITTED purchases only. */
  totalTonnage: number;
  byCategory: Record<OffsetCategory, number>;
  purchaseCount: number;
}

export interface OffsetsOverviewSummary extends OffsetTotals {
  facilitiesReporting: number;
  /** null when no ISSB disclosure exists to compare against. */
  grossEmissionsTco2e: number | null;
  grossEmissionsSource: string;
  netAfterOffsetsTco2e: number | null;
  offsetCoveragePct: number | null;
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
  waterEntries: WaterEntry[];
  calculationResult: EmissionCalculationResult | null;
  /** Present on the single-entry GET, which computes it from waterEntries. */
  waterFootprint?: WaterFootprint;
  verificationRequest?: VerificationRequest | null;
  facility?: Facility;
  // Present wherever the backend computes it — a SUBMITTED entry with no
  // linked SUPPORTING_EVIDENCE document. Never stored, always derived.
  evidencePending?: boolean;
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

// ISSB IFRS S1/S2's Scope 1/2 GHG figures aren't stored here — they're derived
// from the facility's existing ActivityData/EmissionCalculationResult rows
// (AR5 basis), see IssbS1S2Metrics.
export interface IssbS1S2Report {
  id: string;
  companyId: string;
  facilityId: string;
  reportingPeriod: string;
  governanceBodyOversight: string | null;
  managementRole: string | null;
  climateRisksOpportunities: string | null;
  businessModelImpact: string | null;
  financialEffects: string | null;
  scenarioAnalysisResilience: string | null;
  riskIdentificationProcess: string | null;
  riskManagementProcess: string | null;
  riskIntegrationOverall: string | null;
  scope3Tco2e: number | null;
  targetDescription: string | null;
  targetYear: number | null;
  baselineYear: number | null;
  baselineEmissionsTco2e: number | null;
  transitionPlan: string | null;
  internalCarbonPriceInr: number | null;
  climateCapexInr: number | null;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssbS1S2Metrics {
  fyWindow: { start: string; end: string; label: string };
  ghg: {
    scope1Co2e: number;
    scope2Co2e: number;
    scope3Co2e: number | null;
    totalCo2e: number | null;
    activityDataCount: number;
  };
  targets: {
    targetYear: number | null;
    baselineYear: number | null;
    baselineEmissionsTco2e: number | null;
    changeFromBaselinePct: number | null;
  };
  transition: {
    internalCarbonPriceInr: number | null;
    climateCapexInr: number | null;
  };
}

/**
 * The 5 GHG Protocol categories with a calculation path today. Kept as its own
 * union so the per-category switches in scope3-field-config.ts and
 * scope3-entry-form.tsx stay exhaustive now that the full enum has 15 members
 * — only a calculable category can ever reach a data entry form.
 */
export type CalculableScope3Category =
  | "CAT1_PURCHASED_GOODS_SERVICES"
  | "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION"
  | "CAT6_BUSINESS_TRAVEL"
  | "CAT7_EMPLOYEE_COMMUTING"
  | "CAT11_USE_OF_SOLD_PRODUCTS";

/** All 15 GHG Protocol Scope 3 categories — mirrors the Prisma enum. */
export type Scope3Category =
  | CalculableScope3Category
  | "CAT2_CAPITAL_GOODS"
  | "CAT3_FUEL_ENERGY_RELATED"
  | "CAT5_WASTE_GENERATED_IN_OPERATIONS"
  | "CAT8_UPSTREAM_LEASED_ASSETS"
  | "CAT9_DOWNSTREAM_TRANSPORT_DISTRIBUTION"
  | "CAT10_PROCESSING_OF_SOLD_PRODUCTS"
  | "CAT12_END_OF_LIFE_TREATMENT"
  | "CAT13_DOWNSTREAM_LEASED_ASSETS"
  | "CAT14_FRANCHISES"
  | "CAT15_INVESTMENTS";

export type Scope3Relevance = "MANDATORY" | "OPTIONAL" | "NOT_APPLICABLE";

export type OwnershipModel = "OWNED" | "LEASED" | "MIXED";

export type BusinessModel = "MANUFACTURER" | "FRANCHISOR" | "FINANCIAL_INSTITUTION" | "DISTRIBUTOR";

export interface Scope3CategoryRelevance {
  category: number;
  name: string;
  prismaCategory: Scope3Category;
  calculable: boolean;
  relevance: Scope3Relevance;
  reasoning: string;
}

export interface Scope3RelevanceResponse {
  companyId: string;
  sector: string;
  ownershipModel: OwnershipModel;
  businessModel: BusinessModel;
  categories: Scope3CategoryRelevance[];
}

export type Scope3CalculationMethod = "SPEND_BASED" | "ACTIVITY_BASED";

export interface Scope3Data {
  id: string;
  companyId: string;
  facilityId: string;
  reportingPeriod: string;
  category: Scope3Category;
  calculationMethod: Scope3CalculationMethod;
  inputData: Record<string, unknown>;
  calculatedEmissionsTco2e: number;
  emissionFactorSource: string;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Scope3CategoryCatalogEntry {
  number: number;
  name: string;
  prismaCategory: Scope3Category;
  /** False for the 10 categories that have no data entry form yet. */
  calculable: boolean;
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
  gwpTables: { ar2Bur3: GwpTable; ar5: GwpTable };
  waterSources: WaterSourceDefinition[];
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
  // Set when this subscription was auto-merged into a combined tier (e.g.
  // CCTS_COMPLIANCE -> CBAM_PLUS_CCTS) — points at the new subscription's id.
  mergedIntoId: string | null;
  isCustomDeal: boolean;
  customFacilityCount: number | null;
  customValidFrom: string | null;
  customValidUntil: string | null;
  customAmount: number | null;
  customSetByUserId: string | null;
  customDealNotes: string | null;
  // Facilities this subscription currently covers — see backend
  // Subscription.facilitiesIncluded. Superseded by customFacilityCount when
  // isCustomDeal is true.
  facilitiesIncluded: number;
  // Prorated cost of adding one more facility right now — only populated for
  // ACTIVE, non-custom-deal subscriptions (see billing.service.ts's
  // getSubscriptions).
  /** Full per-facility monthly price added from the next billing cycle — not a mid-cycle prorated amount. */
  additionalFacilityMonthlyInr: number | null;
  /** One-time onboarding fee attached to this subscription's first invoice, in rupees; null if none. */
  onboardingFeeChargedInr: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityShortfallRow {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  facilityCount: number;
  facilitiesCovered: number;
  shortfall: number;
  tiers: SubscriptionTier[];
  estimatedMonthlyGapInr: number;
}

export type ManualPaymentMode = "CHEQUE" | "NEFT" | "RTGS" | "UPI" | "CASH" | "OTHER";
export type ManualPaymentStatus = "RECORDED" | "REVERSED";

export interface ManualPayment {
  id: string;
  companyId: string;
  company: { id: string; name: string };
  tier: SubscriptionTier;
  amount: number;
  paymentMode: ManualPaymentMode;
  referenceNumber: string | null;
  paymentDate: string;
  validUntil: string;
  recordedByUserId: string;
  recordedBy: { id: string; name: string; email: string };
  status: ManualPaymentStatus;
  reversedAt: string | null;
  reversedByUserId: string | null;
  reversedBy: { id: string; name: string; email: string } | null;
  reversalReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordManualPaymentInput {
  companyId: string;
  tier: SubscriptionTier;
  amount: number;
  paymentMode: ManualPaymentMode;
  referenceNumber?: string;
  paymentDate: string;
  validUntil: string;
  notes?: string;
}

export interface SetCustomSubscriptionInput {
  tier: SubscriptionTier;
  isCustomDeal: boolean;
  customAmount?: number;
  customFacilityCount?: number;
  customValidFrom?: string;
  customValidUntil?: string;
  customDealNotes?: string;
}

export interface CheckoutResult {
  devBypass: boolean;
  // True when this checkout replaced an existing complementary plan with a
  // combined tier instead of creating a second, separately-billed subscription.
  merged?: boolean;
  razorpayKeyId?: string;
  razorpaySubscriptionId?: string;
  subscription: Subscription;
}

export interface PlanCombinationRule {
  tiers: SubscriptionTier[];
  combinedTier: SubscriptionTier;
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
  qualifications: string | null;
  comments: string | null;
  checklistState: Record<string, boolean>;
  submittedAt: string;
  decidedAt: string | null;
}

export interface VerificationRequestDetail extends VerificationRequest {
  activityData: ActivityData & { facility: Facility & { company: Company } };
}

export type VerificationQueryStatus = "OPEN" | "RESOLVED";

export interface VerificationQuery {
  id: string;
  verificationRequestId: string;
  companyId: string;
  facilityId: string;
  raisedByVerifierId: string;
  raisedByVerifier?: { name: string };
  queryText: string;
  status: VerificationQueryStatus;
  responseText: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnexVIChecklistItem {
  id: string;
  label: string;
  description: string;
}

// --- Verifier portal ---
// Mirrors backend/src/services/verifierFacility.service.ts.

export interface VerifierAssignedFacility {
  id: string;
  name: string;
  company: { id: string; name: string; sector: Sector };
  submittedEntryCount: number;
  evidencePending: boolean;
}

export interface VerifierAssignedCompany {
  id: string;
  name: string;
  sector: Sector;
  facilities: VerifierAssignedFacility[];
}

export interface VerifierCompanyDetail {
  company: { id: string; name: string; sector: Sector };
  facilities: VerifierAssignedFacility[];
}

export interface VerificationMethodologyNote {
  formula: string;
  source: string;
}

export interface VerifierEntryFinancials {
  actualSee: number;
  defaultSee: number;
  seeUnit: string;
  certificatesRequired: number;
  certificatePrice: number;
  certificatePriceQuarter: string;
  grossLiabilityEur: number;
  article9DeductionTonnes: number;
  article9DeductionEur: number;
  netLiabilityEur: number;
  ghgIntensityCcts: number;
  cctsTargetIntensity: number | null;
  cctsDeltaTco2e: number | null;
  methodology: Record<"see" | "cbamLiability" | "cctsIntensity" | "article9", VerificationMethodologyNote>;
}

/**
 * The UK CBAM figures shown to a verifier — null whenever the company isn't
 * in UK scope. Every liability field is nullable rather than the type being
 * a union, because a verifier panel renders the same rows in both states and
 * shows "not published" where a number would be; `status` says which.
 */
export interface VerifierEntryUkCbamFinancials {
  status: "OUT_OF_SCOPE" | "RATE_PENDING" | "CALCULATED";
  reason?: string | null;
  emissionsTco2e?: number;
  specificEmbeddedEmissions?: number;
  excludedIndirectTco2e?: number;
  rateGbpPerTonne?: number | null;
  rateQuarter?: string | null;
  grossLiabilityGbp?: number | null;
  overseasCarbonPriceDeductionGbp?: number | null;
  netLiabilityGbp?: number | null;
  methodology?: Record<"emissions" | "liability" | "overseasCarbonPrice", VerificationMethodologyNote>;
}

export interface VerifierFacilityDetail {
  facility: Facility & { company: Company & { owner: { id: string; name: string; email: string } } };
  activityData: (ActivityData & {
    evidencePending: boolean;
    financials: VerifierEntryFinancials | null;
    ukCbamFinancials: VerifierEntryUkCbamFinancials | null;
  })[];
  documents: AdminDocument[];
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

export type GeneratedReportType = "CBAM" | "CCTS" | "BRSR" | "UK_CBAM";

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
  hasEvidencePendingSubmissions: boolean;
  hasUncrossCheckedEvidence: boolean;
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

// --- Cross-check review (manual document vs. activity-data review) ---
// Mirrors backend/src/services/crossCheckReview.service.ts.

export type CrossCheckStatus = "NOT_REVIEWED" | "MATCHED" | "MISMATCH";

export interface CrossCheckReview {
  id: string;
  activityDataId: string;
  documentId: string;
  status: CrossCheckStatus;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string; email: string } | null;
}

export interface CrossCheckDocument {
  id: string;
  fileName: string;
  createdAt: string;
  crossCheckReview: CrossCheckReview | null;
}

export type CrossCheckEntry = ActivityData & { documents: CrossCheckDocument[] };

// --- Facility dashboard (/facilities/[id]/dashboard) ---
// Mirrors backend/src/services/facilityDashboard.service.ts — that service owns
// all EU-default/GWP/certificate-price business logic, this page only renders
// the numbers it's handed.

export type CctsTone = "SURPLUS" | "ON_TRACK" | "DEFICIT" | "NO_TARGET";

/**
 * One published CBAM certificate reference price, read back from the
 * Emission Factor Manager's supersession chain — not a separate data source.
 */
export interface CertificatePricePoint {
  quarterLabel: string;
  pricePerTonneEur: number;
  validFrom: string;
  source: string;
  /** The single row still in force — the price the liability was computed at. */
  isCurrent: boolean;
}

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
  evidencePending?: boolean;
}

/**
 * The UK CBAM card. `applicable` is false whenever the company doesn't carry
 * UK_CBAM — the backend decides that, so the card is simply absent rather
 * than the frontend re-deriving scope. `status` mirrors the three states the
 * liability engine can return; RATE_PENDING carries real emissions and no
 * liability field at all, which is what stops a zero being rendered as a
 * price.
 */
export type FacilityDashboardUkCbam =
  | { applicable: false }
  | { applicable: true; hasData: false }
  | {
      applicable: true;
      hasData: true;
      status: "OUT_OF_SCOPE";
      periodLabel: string;
      evidencePending: boolean;
      reason: string;
    }
  | {
      applicable: true;
      hasData: true;
      status: "RATE_PENDING";
      periodLabel: string;
      evidencePending: boolean;
      emissionsTco2e: number;
      specificEmbeddedEmissions: number;
      excludedIndirectTco2e: number;
      reason: string;
    }
  | {
      applicable: true;
      hasData: true;
      status: "CALCULATED";
      periodLabel: string;
      evidencePending: boolean;
      emissionsTco2e: number;
      specificEmbeddedEmissions: number;
      excludedIndirectTco2e: number;
      rateGbpPerTonne: number;
      rateQuarter: string;
      netLiabilityGbp: number;
    };

export interface FacilityDashboardCcts {
  hasData: boolean;
  actualIntensity?: number;
  targetIntensity?: number | null;
  tone?: CctsTone;
  deltaTco2e?: number | null;
  periodLabel?: string;
  evidencePending?: boolean;
}

/**
 * The CCC surplus/deficit position, priced where a price exists.
 *
 * The credits themselves are real in every non-TARGET_PENDING state — it is
 * only the valuation that is withheld, and the union is what stops a rupee
 * figure being rendered before there is one. MARKET_NOT_OPEN and
 * PRICE_PENDING are kept apart on purpose: the first cannot be cleared by
 * anyone (CCC trading opens on IEX in October 2026), the second is a Super
 * Admin entering the traded price in the Emission Factor Manager.
 */
export type FacilityDashboardCctsPosition =
  | { status: "TARGET_PENDING"; reason: string }
  | {
      status: "MARKET_NOT_OPEN";
      isSurplus: boolean;
      cccCredits: number;
      targetIntensity: number;
      actualIntensity: number;
      opensLabel: string;
      venue: string;
      reason: string;
    }
  | {
      status: "PRICE_PENDING";
      isSurplus: boolean;
      cccCredits: number;
      targetIntensity: number;
      actualIntensity: number;
      venue: string;
      reason: string;
    }
  | {
      status: "VALUED";
      isSurplus: boolean;
      cccCredits: number;
      targetIntensity: number;
      actualIntensity: number;
      pricePerCreditInr: number;
      priceAsOfDate: string;
      priceSource: string;
      positionValueInr: number;
      /** Deficit only — twice the market price of the shortfall. Null on a surplus. */
      penaltyExposureInr: number | null;
      penaltyMultiplier: number;
      penaltySource: string;
    };

export type FacilityDashboardCccMarketPrice =
  | { status: "MARKET_NOT_OPEN"; opensLabel: string; venue: string; reason: string }
  | { status: "PRICE_PENDING"; venue: string; reason: string }
  | { status: "AVAILABLE"; venue: string; pricePerCreditInr: number; asOfDate: string; source: string };

export interface CccMarketPricePoint {
  asOfDate: string;
  pricePerCreditInr: number;
  source: string;
  isCurrent: boolean;
}

/**
 * One CCTS compliance year of this facility's own trajectory. `targetIntensity`
 * is the entity's own BEE-notified target as entered — never a sector average,
 * which this platform does not hold — and is null for a year with no target on
 * file rather than interpolated.
 */
export interface CctsTargetTrajectoryPoint {
  complianceYear: string;
  targetIntensity: number | null;
  achievedIntensity: number | null;
  periodCount: number;
}

export interface FacilityDashboardCctsCompliance {
  complianceYear: string;
  deadline: string;
  daysRemaining: number;
  reportPeriod: string;
  reportWindowIsOpen: boolean;
  reportWindowOpens: string;
  reportWindowCloses: string;
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
  ukCbam: FacilityDashboardUkCbam;
  certificatePriceTrend: CertificatePricePoint[];
  ccts: FacilityDashboardCcts;
  brsr: FacilityDashboardBrsr;
  deadlines: {
    cbam: FacilityDashboardDeadline;
    cbamAnnual: FacilityDashboardDeadline;
    ukCbam: FacilityDashboardDeadline;
    ccts: FacilityDashboardDeadline;
    brsr: FacilityDashboardDeadline;
  };
  emissionsBreakdown: FacilityDashboardEmissionsBreakdown;
  liabilityTrend: FacilityLiabilityTrendPoint[];
  intensityTrend: FacilityIntensityTrendPoint[];
  intensityTargetLine: number | null;
  /** Null until at least one period has been submitted — there is no position to state before that. */
  cctsPosition: FacilityDashboardCctsPosition | null;
  cccMarketPrice: FacilityDashboardCccMarketPrice;
  cccMarketPriceTrend: CccMarketPricePoint[];
  cctsTargetTrajectory: CctsTargetTrajectoryPoint[];
  cctsCompliance: FacilityDashboardCctsCompliance;
  recentActivity: FacilityActivityFeedItem[];
  hasEvidencePendingSubmissions: boolean;
  crossCheckSummary: { total: number; matched: number };
  hasUncrossCheckedEvidence: boolean;
}

export interface CompanyEmissionsTrendPoint {
  periodLabel: string;
  scope1Tco2e: number;
  scope2Tco2e: number;
  precursorTco2e: number;
  totalTco2e: number;
}

export interface CompanyLiabilityTrendPoint {
  quarterLabel: string;
  actualLiabilityEur: number;
  defaultLiabilityEur: number;
}

export interface CompanyEmissionsComposition {
  hasData: boolean;
  periodLabel?: string;
  totalTco2e?: number;
  segments?: { label: string; valueTco2e: number; pct: number }[];
}

export interface CompanyCctsIntensity {
  hasData: boolean;
  periodLabel?: string;
  actualIntensity?: number;
  targetIntensity?: number | null;
  tone?: CctsTone;
}

export interface CompanyFacilityComparisonPoint {
  facilityId: string;
  facilityName: string;
  actualSee: number;
  seeUnit: string;
  periodLabel: string;
}

export interface CompanyYearOverYear {
  hasData: boolean;
  thisYear?: { emissionsTco2e: number; liabilityEur: number };
  lastYear?: { emissionsTco2e: number; liabilityEur: number };
  emissionsDeltaPct?: number | null;
  liabilityDeltaPct?: number | null;
}

export interface CompanyBrsrWaterTrendPoint {
  periodLabel: string;
  withdrawnKl: number;
  dischargedKl: number;
  consumedKl: number;
}

export interface CompanyBrsrWasteTrendPoint {
  periodLabel: string;
  generatedTonnes: number;
  recoveredTonnes: number;
}

export interface CompanyBrsrEnergyComposition {
  hasData: boolean;
  periodLabel?: string;
  renewableGj?: number;
  nonRenewableGj?: number;
  renewablePct?: number;
}

export interface CompanyBrsrGenderDiversity {
  hasData: boolean;
  periodLabel?: string;
  femaleCount?: number;
  maleCount?: number;
  womenPct?: number;
}

export interface CompanyBrsrSafetyIncidentRate {
  hasData: boolean;
  periodLabel?: string;
  currentRate?: number;
  previousRate?: number;
  deltaPct?: number | null;
}

export interface CompanyBrsrFacilityComparisonPoint {
  facilityId: string;
  facilityName: string;
  value: number;
  unit: string;
  periodLabel: string;
}

export interface CompanyBrsrAnalytics {
  hasReports: boolean;
  waterTrend: CompanyBrsrWaterTrendPoint[];
  wasteTrend: CompanyBrsrWasteTrendPoint[];
  energyComposition: CompanyBrsrEnergyComposition;
  genderDiversity: CompanyBrsrGenderDiversity;
  safetyIncidentRate: CompanyBrsrSafetyIncidentRate;
  facilityComparison: CompanyBrsrFacilityComparisonPoint[];
}

/** Company-wide UK CBAM. `currentRate` is null — never 0 — while no rate is published. */
export type CompanyUkCbamAnalytics =
  | { applicable: false }
  | {
      applicable: true;
      currentRate: { ratePerTonneGbp: number; quarterLabel: string } | null;
      liabilityTrend: { quarterLabel: string; emissionsTco2e: number; liabilityGbp: number | null }[];
    };

/**
 * "Live position" strip item — mirrors backend/src/services/livePosition.helpers.ts.
 * Every item is computed from real data; the backend omits anything it can't
 * compute, so the frontend never has to render a placeholder.
 */
export interface LivePositionItem {
  id: string;
  kind: "DATA_UPDATE" | "DEADLINE" | "TREND" | "PRICE";
  label: string;
  detail: string;
  timestamp: string | null;
  deltaPct?: number;
  lowerIsBetter?: boolean;
  href?: string;
}

export interface CompanyDashboardAnalytics {
  facilityCount: number;
  livePosition: LivePositionItem[];
  emissionsTrend: CompanyEmissionsTrendPoint[];
  liabilityTrend: CompanyLiabilityTrendPoint[];
  currentCertificatePrice: { pricePerTonneEur: number; quarterLabel: string };
  emissionsComposition: CompanyEmissionsComposition;
  cctsIntensity: CompanyCctsIntensity;
  ukCbam: CompanyUkCbamAnalytics;
  facilityComparison: CompanyFacilityComparisonPoint[];
  yearOverYear: CompanyYearOverYear;
  // null when the company has no active BRSR Core subscription.
  brsr: CompanyBrsrAnalytics | null;
}

// --- Unified ESG Overview (/esg) ---
// Mirrors backend/src/services/esgOverview.service.ts.

export interface EsgFrameworkCompleteness {
  periodLabel: string | null;
  complete: number;
  total: number;
  requirements: { key: string; label: string; complete: boolean }[];
}

export interface EsgIssbSummary {
  hasReports: boolean;
  periodLabel: string | null;
  facilitiesReporting: number;
  scope1Tco2e: number;
  scope2Tco2e: number;
  scope3Tco2e: number | null;
  totalTco2e: number;
  nearestTargetYear: number | null;
  baselineYear: number | null;
  baselineEmissionsTco2e: number | null;
  changeFromBaselinePct: number | null;
}

export interface EsgScope3CategoryBreakdownEntry {
  category: number;
  name: string;
  prismaCategory: string;
  relevance: Scope3Relevance;
  tco2e: number;
  pct: number;
  entryCount: number;
}

export interface EsgScope3Summary {
  hasData: boolean;
  periodLabel: string | null;
  totalTco2e: number;
  categories: EsgScope3CategoryBreakdownEntry[];
  mandatoryCalculableCount: number;
  mandatoryCalculableDisclosed: number;
}

export interface EsgOverview {
  companyName: string;
  facilityCount: number;
  currentFyLabel: string;
  brsr: CompanyBrsrAnalytics;
  issb: EsgIssbSummary;
  scope3: EsgScope3Summary;
  /** ISO 14046 water footprint rolled up from submitted ActivityData. */
  water: WaterFootprintRollup;
  offsets: OffsetsOverviewSummary;
  completeness: {
    brsr: EsgFrameworkCompleteness;
    issb: EsgFrameworkCompleteness;
    scope3: EsgFrameworkCompleteness;
  };
  livePosition: LivePositionItem[];
}

export interface FacilityDocument {
  id: string;
  documentType: "REPORT" | "SUPPORTING_EVIDENCE";
  reportingPeriod: string;
  verified: boolean;
  fileName: string;
  createdAt: string;
  activityDataId: string | null;
  reportId: string | null;
}

// --- Super Admin dashboard (/admin) ---
// Mirrors backend/src/services/adminOverview.service.ts, adminCompanies.service.ts,
// adminFacilities.service.ts.

export interface AdminOverviewMetrics {
  totalCompanies: number;
  totalUsers: number;
  totalReports: number;
  totalLeadCaptures: number;
}

export interface AdminRecentSignup {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  sector: Sector | null;
  plans: SubscriptionTier[];
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface AdminActivityLogEntry {
  id: string;
  userEmail: string | null;
  action: string;
  detail: string;
  createdAt: string;
}

export interface AdminOverview {
  metrics: AdminOverviewMetrics;
  recentSignups: AdminRecentSignup[];
  recentActivity: AdminActivityLogEntry[];
  recentLeads: LeadCapture[];
}

export interface AdminCompanySummary {
  id: string;
  name: string;
  registrationNumber: string | null;
  gstin: string | null;
  sector: Sector;
  ownerEmail: string;
  plans: SubscriptionTier[];
  facilityCount: number;
  lastActivity: string;
  createdAt: string;
}

export interface AdminVerifierSummary {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  assignedCompanyCount?: number;
  active?: boolean;
}

export interface CompanyVerifierAssignment {
  id: string;
  verifier: AdminVerifierSummary;
  assignedAt: string;
}

export interface AdminCompanyDetail extends Company {
  owner: { id: string; name: string; email: string; approvalStatus: string; createdAt: string };
  subscriptions: Subscription[];
  facilities: (Facility & { _count: { activityData: number } })[];
  verifierAssignments: CompanyVerifierAssignment[];
}

export interface AdminRevenueMetrics {
  totalMrrInr: number;
  totalCompaniesPaying: number;
  projectedArrInr: number;
  cancelledThisMonth: number;
}

export interface AdminRevenuePlanDistributionEntry {
  tier: SubscriptionTier;
  planName: string;
  subscriberCount: number;
  mrrInr: number;
}

export interface AdminRevenueSubscriptionRow {
  id: string;
  companyName: string;
  ownerEmail: string;
  tier: SubscriptionTier;
  facilityCount: number;
  monthlyPriceInr: number;
  status: SubscriptionStatus;
  subscribedAt: string;
  cancelledAt: string | null;
}

export interface AdminRevenueTrendPoint {
  month: string;
  monthLabel: string;
  mrrInr: number;
}

export interface AdminRevenue {
  metrics: AdminRevenueMetrics;
  planDistribution: AdminRevenuePlanDistributionEntry[];
  subscriptions: AdminRevenueSubscriptionRow[];
  trend: AdminRevenueTrendPoint[];
  trendHasFullHistory: boolean;
}

export interface AdminDocument {
  id: string;
  documentType: string;
  reportingPeriod: string;
  verified: boolean;
  fileName: string;
  createdAt: string;
}

export interface AdminReport {
  id: string;
  reportType: GeneratedReportType;
  period: string;
  generatedAt: string;
  status: string;
  document: { id: string } | null;
}

export interface AdminInternalOperatorSummary {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  active?: boolean;
}

export interface FacilityAssignmentSummary {
  id: string;
  user: AdminInternalOperatorSummary;
  assignedAt: string;
}

export interface AdminFacilityDetail extends Facility {
  company: Company & { owner: { id: string; name: string; email: string } };
  activityData: ActivityData[];
  documents: AdminDocument[];
  reports: AdminReport[];
  assignments: FacilityAssignmentSummary[];
}

// --- Internal data-entry portal (DATA_ENTRY_INTERNAL) ---
// Mirrors backend/src/services/internalDataEntry.service.ts. Deliberately
// thin — no financials, no calculation breakdown, no billing — this portal
// is scoped to data entry only.

export interface InternalAssignedFacility {
  id: string;
  name: string;
  sector: Sector;
  company: { id: string; name: string; sector: Sector };
  entryCount: number;
  evidencePending: boolean;
}

export interface InternalActivityDataSummary {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  productCategory: string | null;
  productionQuantityT: number | null;
  status: "DRAFT" | "SUBMITTED";
  evidencePending: boolean;
  updatedAt: string;
}

export interface InternalFacilityDetail {
  facility: {
    id: string;
    name: string;
    sector: Sector;
    productionRoute: ProductionRoute | null;
    isDraft: boolean;
    company: { id: string; name: string; sector: Sector };
  };
  entries: InternalActivityDataSummary[];
}

// --- Emission Factor Manager (/admin/emission-factors) ---
// Mirrors backend/src/services/emissionFactor.service.ts. Every value
// change preserves history — see the /supersede endpoint — rather than
// overwriting a row in place, so `validTo` is only ever set on rows that
// have since been superseded.

export interface EmissionFactor {
  id: string;
  name: string;
  fuelType: string | null;
  greenhouseGas: string | null;
  value: number;
  unit: string;
  source: string;
  validFrom: string;
  validTo: string | null;
  sectorApplicability: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmissionFactorInput {
  name: string;
  fuelType?: string;
  greenhouseGas?: string;
  value: number;
  unit: string;
  source: string;
  validFrom: string;
  validTo?: string;
  sectorApplicability?: string;
}

export interface UpdateEmissionFactorInput {
  name?: string;
  fuelType?: string;
  greenhouseGas?: string;
  unit?: string;
  source: string;
  validFrom?: string;
  validTo?: string;
  sectorApplicability?: string;
}

export interface QuickUpdateValueInput {
  value: number;
  source: string;
}

// --- CCTS Obligated Entities Tracker (/admin/regulatory-watch, /ccts-obligated-entities) ---
// Manually-verified registry of BEE gazette-notified CCTS obligated
// companies/plants — see backend/prisma/schema.prisma CctsObligatedEntity.

export type CctsEntityStatus = "DRAFT" | "FINAL";

export interface CctsObligatedEntity {
  id: string;
  companyName: string;
  sector: string;
  subSector: string | null;
  state: string;
  district: string | null;
  notificationReference: string;
  notificationDate: string;
  status: CctsEntityStatus;
  baselineIntensity: number | null;
  targetIntensity: number | null;
  sourceUrl: string | null;
  lastVerifiedDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCctsObligatedEntityInput {
  companyName: string;
  sector: string;
  subSector?: string;
  state: string;
  district?: string;
  notificationReference: string;
  notificationDate: string;
  status: CctsEntityStatus;
  baselineIntensity?: number;
  targetIntensity?: number;
  sourceUrl?: string;
  lastVerifiedDate: string;
}

export type UpdateCctsObligatedEntityInput = Partial<CreateCctsObligatedEntityInput>;

export interface CctsBulkImportRowResult {
  row: number;
  companyName?: string;
  success: boolean;
  error?: string;
}

// --- GHG Runner (/admin/ghg-runner) ---
// Mirrors backend/src/data/ghgJurisdictions.ts and
// backend/src/services/ghgCalculation.service.ts. Foreign consulting
// engagements — organization-based, not facility-based, no client login.

export type GhgJurisdictionKey = "US_CALIFORNIA" | "UK" | "AUSTRALIA" | "UAE_MIDDLE_EAST" | "EU" | "OTHER_GHG_PROTOCOL";
export type GhgEngagementStatus = "DRAFT" | "FINALIZED";

export interface GhgJurisdictionGwpSet {
  scheme: "AR5" | "AR6";
  co2: number;
  ch4: number;
  n2o: number;
}

export interface GhgJurisdictionConfig {
  key: GhgJurisdictionKey;
  label: string;
  regulationLabel: string;
  gwp: GhgJurisdictionGwpSet;
  gwpSource: string;
}

export interface GhgScope1Entry {
  id: string;
  /** A FUEL_LIBRARY key (see FuelDefinition), or "CUSTOM". */
  sourceType: string;
  label: string;
  quantity: number;
  unit: string;
  isCustom: boolean;
  customFactorValue?: number;
  source: string;
}

export interface GhgScope1EntryResult extends GhgScope1Entry {
  co2eTonnes: number;
  factorApplied: string;
}

export interface GhgScope2Entry {
  id: string;
  label: string;
  quantityValue: number;
  quantityUnit: "kWh" | "MWh";
  gridFactorValue: number;
  source: string;
}

export interface GhgScope2EntryResult extends GhgScope2Entry {
  co2eTonnes: number;
}

/** Schema-ready, UI-disabled — "Coming soon" in the data entry form. */
export interface GhgScope3Entry {
  id: string;
  scope3Category: number;
  description: string;
  quantity: number;
  factor: number;
  source: string;
}

export interface GhgCalculationResult {
  jurisdiction: GhgJurisdictionKey;
  gwpScheme: string;
  gwpSource: string;
  scope1Results: GhgScope1EntryResult[];
  scope2Results: GhgScope2EntryResult[];
  scope1TotalTco2e: number;
  scope2TotalTco2e: number;
  totalTco2e: number;
}

export interface GhgEngagementSummary {
  id: string;
  organizationName: string;
  country: string;
  jurisdiction: GhgJurisdictionKey;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  numberOfSites: number | null;
  status: GhgEngagementStatus;
  scope1TotalTco2e: number | null;
  scope2TotalTco2e: number | null;
  totalTco2e: number | null;
  reportGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GhgEngagement {
  id: string;
  organizationName: string;
  country: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  jurisdiction: GhgJurisdictionKey;
  numberOfSites: number | null;
  scope1Entries: GhgScope1Entry[];
  scope2Entries: GhgScope2Entry[];
  scope3Entries: GhgScope3Entry[];
  scope1TotalTco2e: number | null;
  scope2TotalTco2e: number | null;
  totalTco2e: number | null;
  gwpSchemeUsed: string | null;
  status: GhgEngagementStatus;
  reportPdfFileName: string | null;
  reportGeneratedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GhgEngagementInput {
  organizationName: string;
  country: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  jurisdiction: GhgJurisdictionKey;
  numberOfSites?: number;
  scope1Entries: GhgScope1Entry[];
  scope2Entries: GhgScope2Entry[];
  scope3Entries: GhgScope3Entry[];
}

// --- GRI Standards 2021 ---

export type GriImpactType =
  | "NEGATIVE_ACTUAL"
  | "NEGATIVE_POTENTIAL"
  | "POSITIVE_ACTUAL"
  | "POSITIVE_POTENTIAL";

export type GriValueChainLocation = "OWN_OPERATIONS" | "UPSTREAM" | "DOWNSTREAM";

export interface GriImpact {
  id: string;
  assessmentId: string;
  topicCode: string;
  description: string;
  impactType: GriImpactType;
  valueChainLocation: GriValueChainLocation;
  scale: number;
  scope: number;
  irremediability: number | null;
  likelihood: number | null;
  /** Derived server-side by computeImpactSignificance — never sent by the client. */
  significanceScore: number;
}

export interface GriMaterialityAssessment {
  id: string;
  griReportId: string;
  stakeholderGroups: string[];
  stakeholderEngagementApproach: string | null;
  impactIdentificationProcess: string | null;
  prioritisationProcess: string | null;
  materialityThreshold: number;
  /** Non-null once the assessment is complete — topic gating only applies from then. */
  completedAt: string | null;
  impacts?: GriImpact[];
}

export interface GriMaterialTopic {
  id: string;
  griReportId: string;
  topicCode: string;
  isMaterial: boolean;
  significanceScore: number | null;
  rank: number | null;
  notMaterialRationale: string | null;
  // GRI 3-3
  impactsDescription: string | null;
  involvementDescription: string | null;
  policiesCommitments: string | null;
  actionsTaken: string | null;
  effectivenessTracking: string | null;
  stakeholderEngagement: string | null;
}

export interface GriTopicRanking {
  topicCode: string;
  significanceScore: number;
  impactCount: number;
  meetsThreshold: boolean;
  rank: number;
}

export interface GriTopicCompleteness {
  topicCode: string;
  label: string;
  title: string;
  isMaterial: boolean;
  managementApproachComplete: boolean;
  missingManagementApproachFields: string[];
  disclosuresReported: number;
  disclosuresTotal: number;
  hasAnyData: boolean;
}

export interface GriAccordanceEvaluation {
  inAccordance: boolean;
  universalDisclosuresReported: number;
  universalDisclosuresTotal: number;
  missingUniversalDisclosures: string[];
  materialityAssessmentComplete: boolean;
  materialTopicCount: number;
  unexplainedExclusions: string[];
  topics: GriTopicCompleteness[];
  blockers: string[];
}

export interface GriMetrics {
  fyWindow: { start: string; end: string; label: string };
  ghg: {
    scope1Co2e: number;
    scope2LocationBasedCo2e: number;
    scope3Co2e: number | null;
    scope3CategoryCount: number;
    totalScope1And2Co2e: number;
    productionQuantityT: number;
    electricityAndSteamEnergyGj: number;
    renewableElectricityGj: number;
    activityDataCount: number;
  };
  water: {
    hasData: boolean;
    withdrawalTotalMl: number;
    dischargeTotalMl: number;
    consumptionTotalMl: number;
    withdrawalFreshwaterMl: number;
    entriesWithWater: number;
  };
  waste: {
    hasData: boolean;
    totalGeneratedT: number;
    totalDivertedT: number;
    totalDisposalT: number;
    diversionRatePct: number | null;
  };
  safety: {
    hasData: boolean;
    rateBasisHours: number;
    fatalityRate: number | null;
    highConsequenceInjuryRate: number | null;
    recordableInjuryRate: number | null;
    totalFatalities: number;
    totalRecordableInjuries: number;
  };
  intensity: {
    emissionsPerTonneProduct: number | null;
    emissionsPerRupeeTurnover: number | null;
    energyPerTonneProduct: number | null;
    energyPerRupeeTurnover: number | null;
  };
  rankings: GriTopicRanking[];
  accordance: GriAccordanceEvaluation;
}

/** Disclosure rows are heterogeneous per topic — the form reads them by field name from the registry. */
export type GriTopicRow = Record<string, string | number | boolean | null>;

export interface GriReport {
  id: string;
  companyId: string;
  facilityId: string;
  reportingPeriod: string;
  turnoverInr: number | null;
  status: "DRAFT" | "SUBMITTED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  materialityAssessment?: GriMaterialityAssessment | null;
  universalDisclosures?: GriTopicRow | null;
  materialTopics: GriMaterialTopic[];
  materialsDisclosure?: GriTopicRow | null;
  energyDisclosure?: GriTopicRow | null;
  waterDisclosure?: GriTopicRow | null;
  biodiversityDisclosure?: GriTopicRow | null;
  emissionsDisclosure?: GriTopicRow | null;
  wasteDisclosure?: GriTopicRow | null;
  supplierEnvDisclosure?: GriTopicRow | null;
  employmentDisclosure?: GriTopicRow | null;
  ohsDisclosure?: GriTopicRow | null;
  trainingDisclosure?: GriTopicRow | null;
  diversityDisclosure?: GriTopicRow | null;
  nonDiscriminationDisclosure?: GriTopicRow | null;
  localCommunitiesDisclosure?: GriTopicRow | null;
  supplierSocialDisclosure?: GriTopicRow | null;
  customerHsDisclosure?: GriTopicRow | null;
  customerPrivacyDisclosure?: GriTopicRow | null;
}

export type GriOmissionReason =
  | "NOT_APPLICABLE"
  | "CONFIDENTIALITY_CONSTRAINTS"
  | "LEGAL_PROHIBITIONS"
  | "INFORMATION_UNAVAILABLE_INCOMPLETE";

export interface GriContentIndexEntry {
  standard: string;
  disclosureNumber: string;
  title: string;
  pageNumber: number | null;
  reported: boolean;
  omissionReason: GriOmissionReason | null;
  omissionExplanation: string | null;
  derived: boolean;
  section: "UNIVERSAL" | "MATERIAL_TOPICS" | "TOPIC";
  topicCode: string | null;
}

export interface GriContentIndex {
  entries: GriContentIndexEntry[];
  claimLevel: "IN_ACCORDANCE" | "WITH_REFERENCE";
  claimStatement: string;
  gri1Version: string;
  reportedCount: number;
  omittedCount: number;
  excludedTopics: { standard: string; title: string; rationale: string }[];
}
