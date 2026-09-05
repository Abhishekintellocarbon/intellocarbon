import type { ReportContext } from "./report.service";
import { getCbamCertificatePrice, getEuDefaultSee, getCbamActivity } from "../data/cbamReferenceData";

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

export type CbamReportType = "CBAM" | "CCTS" | "UK_CBAM";

/**
 * The marker that goes in the reference. UK_CBAM is rendered "UKCBAM" rather
 * than passed through verbatim so the reference stays a single unbroken token
 * (an underscore reads as a field separator next to the hyphens around it).
 */
const REFERENCE_MARKER: Record<CbamReportType, string> = {
  CBAM: "CBAM",
  CCTS: "CCTS",
  UK_CBAM: "UKCBAM",
};

/**
 * CBAM and CCTS reports for the same activity data entry used to share this
 * exact reference number (both derived it from the same ctx.id with no
 * report-type marker) — two different regulatory documents could carry an
 * identical Document ID. The type prefix disambiguates them; the digit suffix
 * itself is unchanged so a report generated before this fix and one generated
 * after still share the same stable digits for the same underlying data.
 *
 * The UK CBAM return is a third document over that same entry, and a company
 * in scope for both regimes files both — so it needs its own marker for the
 * same reason, or its return and the EU package would carry one ID between
 * them. The EU and CCTS markers are unchanged.
 */
export const reportReferenceNumber = (ctx: ReportContext, reportType: CbamReportType): string => {
  const quarter = Math.floor(ctx.periodEnd.getUTCMonth() / 3) + 1;
  return `ICT-${REFERENCE_MARKER[reportType]}-${ctx.periodEnd.getUTCFullYear()}-Q${quarter}-${stableDigits(ctx.id)}`;
};

/**
 * The certificate arithmetic, on its own.
 *
 * Split out of computeCbamFinancialImpact so Pathway Modelling can price a
 * *projected* emissions figure through exactly the formula that prices the
 * actual one — including the Article 9 deduction, which is not a flat
 * percentage and would be the easiest thing in the product to get subtly wrong
 * in a second implementation. Nothing here reads the database or the clock;
 * the caller supplies the price so a projection and the report it is compared
 * against are priced at the same certificate price.
 */
export interface CbamCertificateArithmetic {
  certificatesRequired: number;
  article9DeductionTonnes: number;
  netCertificates: number;
  grossLiabilityEur: number;
  article9DeductionEur: number;
  netLiabilityEur: number;
}

export const computeCbamCertificateArithmetic = (input: {
  /** Total CBAM-basis (AR5) emissions for the period, tCO2e. */
  totalEmissionsCbamAr5: number;
  /** Tonnes of product, or MWh exported to the EU for the electricity sector. */
  production: number;
  /** Carbon price effectively paid in the country of origin, EUR/tCO2e. */
  carbonPricePaidEurPerTonne: number;
  certificatePrice: number;
}): CbamCertificateArithmetic => {
  const certificatesRequired = input.totalEmissionsCbamAr5;
  const article9DeductionTonnes =
    input.carbonPricePaidEurPerTonne > 0
      ? Math.min(certificatesRequired, (input.carbonPricePaidEurPerTonne * input.production) / input.certificatePrice)
      : 0;
  const netCertificates = Math.max(0, certificatesRequired - article9DeductionTonnes);

  return {
    certificatesRequired,
    article9DeductionTonnes,
    netCertificates,
    grossLiabilityEur: certificatesRequired * input.certificatePrice,
    article9DeductionEur: article9DeductionTonnes * input.certificatePrice,
    netLiabilityEur: netCertificates * input.certificatePrice,
  };
};

/**
 * CCTS compliance position in tCO2e — positive is a surplus against the
 * BEE-notified intensity target, negative a deficit.
 *
 * A one-line formula, but exported for the same reason as the certificate
 * arithmetic above: Pathway Modelling projects this number forward, and a
 * second copy of even a one-liner is a place for the sign convention to drift.
 */
export const cctsPositionTco2e = (targetIntensity: number, actualIntensity: number, production: number): number =>
  (targetIntensity - actualIntensity) * production;

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

export const computeCbamFinancialImpact = (ctx: ReportContext, reportType: CbamReportType): CbamFinancialImpact => {
  const result = ctx.calculationResult!;
  // Electricity's CBAM SEE is per MWh exported to the EU, not per tonne of product.
  const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;

  const actualSee = result.specificEmbeddedEmissionsCbam;
  const defaultRef = getEuDefaultSee(ctx.sector, ctx.facility.productionRoute, ctx.productCategory);
  const defaultSee = defaultRef.valueTco2ePerTonne;
  const varianceFromDefault = defaultSee - actualSee;

  const cbamCertificatePrice = getCbamCertificatePrice();
  const certificatePrice = cbamCertificatePrice.pricePerTonneEur;
  const carbonPricePaidEurPerTonne = ctx.carbonPricePaidEurPerTonne ?? 0;

  const { certificatesRequired, article9DeductionTonnes, netCertificates, grossLiabilityEur, article9DeductionEur, netLiabilityEur } =
    computeCbamCertificateArithmetic({
      totalEmissionsCbamAr5: result.totalEmissionsCbamAr5,
      production,
      carbonPricePaidEurPerTonne,
      certificatePrice,
    });

  const savingVsDefaultEur = varianceFromDefault * production * certificatePrice;

  const cctsPosition: CctsCccPosition | CctsCccPositionResolved =
    ctx.cctsTargetIntensity != null
      ? {
          pending: false,
          targetIntensity: ctx.cctsTargetIntensity,
          actualIntensity: result.ghgIntensityCcts,
          deltaTco2e: round(cctsPositionTco2e(ctx.cctsTargetIntensity, result.ghgIntensityCcts, production), 2),
          isSurplus: ctx.cctsTargetIntensity - result.ghgIntensityCcts >= 0,
        }
      : { pending: true };

  return {
    reportReference: reportReferenceNumber(ctx, reportType),

    actualSee: round(actualSee),
    defaultSee: round(defaultSee),
    defaultSeeSource: defaultRef.source,
    varianceFromDefault: round(varianceFromDefault),
    varianceIsBetterThanDefault: varianceFromDefault >= 0,

    certificatePrice,
    certificatePriceQuarter: cbamCertificatePrice.quarterLabel,
    certificatePriceAsOfDate: cbamCertificatePrice.asOfDate,
    certificatePriceSource: cbamCertificatePrice.source,

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
