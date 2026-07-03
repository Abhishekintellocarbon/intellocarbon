import type { ReportContext } from "./report.service";
import { CBAM_CERTIFICATE_PRICE, getEuDefaultSee, getCbamActivity } from "../data/cbamReferenceData";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Stable 4-digit code derived from the activity data id, so the same report always shows the same reference number. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String(1000 + (hash % 9000));
};

export const reportReferenceNumber = (ctx: ReportContext): string => {
  const quarter = Math.floor(ctx.periodEnd.getUTCMonth() / 3) + 1;
  return `ICT-${ctx.periodEnd.getUTCFullYear()}-Q${quarter}-${stableDigits(ctx.id)}`;
};

export interface CctsCccPosition {
  pending: true;
}

export interface CctsCccPositionResolved {
  pending: false;
  targetIntensity: number;
  actualIntensity: number;
  deltaTco2e: number;
  isSurplus: boolean;
}

export interface CbamFinancialImpact {
  reportReference: string;

  actualSee: number;
  defaultSee: number;
  defaultSeeSource: string;
  varianceFromDefault: number;
  varianceIsBetterThanDefault: boolean;

  certificatePrice: number;
  certificatePriceQuarter: string;
  certificatePriceAsOfDate: string;
  certificatePriceSource: string;

  certificatesRequired: number;
  carbonPricePaidEurPerTonne: number;
  article9DeductionTonnes: number;
  netCertificates: number;

  grossLiabilityEur: number;
  article9DeductionEur: number;
  netLiabilityEur: number;
  savingVsDefaultEur: number;

  cbamActivity: string;

  cctsPosition: CctsCccPosition | CctsCccPositionResolved;
}

export const computeCbamFinancialImpact = (ctx: ReportContext): CbamFinancialImpact => {
  const result = ctx.calculationResult!;
  // Electricity's CBAM SEE is per MWh exported to the EU, not per tonne of product.
  const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;

  const actualSee = result.specificEmbeddedEmissionsCbam;
  const defaultRef = getEuDefaultSee(ctx.sector, ctx.facility.productionRoute, ctx.productCategory);
  const defaultSee = defaultRef.valueTco2ePerTonne;
  const varianceFromDefault = defaultSee - actualSee;

  const certificatePrice = CBAM_CERTIFICATE_PRICE.pricePerTonneEur;
  const certificatesRequired = result.totalEmissionsCbamAr5;

  const carbonPricePaidEurPerTonne = ctx.carbonPricePaidEurPerTonne ?? 0;
  const article9DeductionTonnes =
    carbonPricePaidEurPerTonne > 0
      ? Math.min(certificatesRequired, (carbonPricePaidEurPerTonne * production) / certificatePrice)
      : 0;
  const netCertificates = Math.max(0, certificatesRequired - article9DeductionTonnes);

  const grossLiabilityEur = certificatesRequired * certificatePrice;
  const article9DeductionEur = article9DeductionTonnes * certificatePrice;
  const netLiabilityEur = netCertificates * certificatePrice;
  const savingVsDefaultEur = varianceFromDefault * production * certificatePrice;

  const cctsPosition: CctsCccPosition | CctsCccPositionResolved =
    ctx.cctsTargetIntensity != null
      ? {
          pending: false,
          targetIntensity: ctx.cctsTargetIntensity,
          actualIntensity: result.ghgIntensityCcts,
          deltaTco2e: round((ctx.cctsTargetIntensity - result.ghgIntensityCcts) * production, 2),
          isSurplus: ctx.cctsTargetIntensity - result.ghgIntensityCcts >= 0,
        }
      : { pending: true };

  return {
    reportReference: reportReferenceNumber(ctx),

    actualSee: round(actualSee),
    defaultSee: round(defaultSee),
    defaultSeeSource: defaultRef.source,
    varianceFromDefault: round(varianceFromDefault),
    varianceIsBetterThanDefault: varianceFromDefault >= 0,

    certificatePrice,
    certificatePriceQuarter: CBAM_CERTIFICATE_PRICE.quarterLabel,
    certificatePriceAsOfDate: CBAM_CERTIFICATE_PRICE.asOfDate,
    certificatePriceSource: CBAM_CERTIFICATE_PRICE.source,

    certificatesRequired: round(certificatesRequired, 2),
    carbonPricePaidEurPerTonne,
    article9DeductionTonnes: round(article9DeductionTonnes, 2),
    netCertificates: round(netCertificates, 2),

    grossLiabilityEur: round(grossLiabilityEur, 2),
    article9DeductionEur: round(article9DeductionEur, 2),
    netLiabilityEur: round(netLiabilityEur, 2),
    savingVsDefaultEur: round(savingVsDefaultEur, 2),

    cbamActivity: getCbamActivity(ctx.sector, ctx.facility.productionRoute),

    cctsPosition,
  };
};
