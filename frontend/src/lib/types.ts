import type { LeadCapture } from "./intellocalc-types";

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

export interface VerifierFacilityDetail {
  facility: Facility & { company: Company & { owner: { id: string; name: string; email: string } } };
  activityData: (ActivityData & { evidencePending: boolean; financials: VerifierEntryFinancials | null })[];
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
  hasEvidencePendingSubmissions: boolean;
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
  evidencePending?: boolean;
}

export interface FacilityDashboardCcts {
  hasData: boolean;
  actualIntensity?: number;
  targetIntensity?: number | null;
  tone?: CctsTone;
  deltaTco2e?: number | null;
  periodLabel?: string;
  evidencePending?: boolean;
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
  hasEvidencePendingSubmissions: boolean;
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
