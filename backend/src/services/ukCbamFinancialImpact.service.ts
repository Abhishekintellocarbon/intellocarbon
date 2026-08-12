import type { ReportContext } from "./report.service";
import { getUkCbamRate } from "../data/ukCbamReferenceData";
import { isUkCbamSector, UK_CBAM_DEFERRED_EMISSIONS, UK_CBAM_INCLUDED_EMISSION_SCOPES } from "../data/ukCbamReferenceData";
import { reportReferenceNumber } from "./cbamFinancialImpact.service";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * UK CBAM liability for one activity data entry — the UK counterpart of
 * computeCbamFinancialImpact, kept as a separate function rather than a
 * parameterised version of it because almost nothing carries across: a
 * different emissions boundary, a different currency, no published default
 * values to compare against, and a rate that may not exist yet.
 *
 * The three states below are the whole point of the return type. A caller
 * must not be able to render a liability without having handled "this
 * company isn't in UK scope" and "HMRC hasn't published a rate", and a
 * discriminated union is what forces that at the type level rather than
 * leaving a zero to be mistaken for a real figure.
 */
export type UkCbamFinancialImpact =
  | UkCbamOutOfScope
  | UkCbamRatePending
  | UkCbamLiability;

export interface UkCbamOutOfScope {
  status: "OUT_OF_SCOPE";
  reportReference: string;
  reason: string;
}

/** Emissions are known and final; only the price is missing. */
export interface UkCbamRatePending {
  status: "RATE_PENDING";
  reportReference: string;
  emissionsTco2e: number;
  specificEmbeddedEmissions: number;
  includedScopes: typeof UK_CBAM_INCLUDED_EMISSION_SCOPES;
  excludedIndirectTco2e: number;
  reason: string;
}

export interface UkCbamLiability {
  status: "CALCULATED";
  reportReference: string;

  emissionsTco2e: number;
  specificEmbeddedEmissions: number;
  includedScopes: typeof UK_CBAM_INCLUDED_EMISSION_SCOPES;
  excludedIndirectTco2e: number;

  rateGbpPerTonne: number;
  rateQuarter: string;
  rateAsOfDate: string;
  rateSource: string;

  grossLiabilityGbp: number;
  carbonPricePaidGbpPerTonne: number;
  overseasCarbonPriceDeductionTco2e: number;
  overseasCarbonPriceDeductionGbp: number;
  netLiabilityGbp: number;
}

/**
 * Indirect emissions carried by the entry but excluded from the UK total —
 * reported alongside the liability so the gap between the EU and UK figures
 * for the same entry is visible rather than looking like an arithmetic error.
 * Read from the stored EU columns, which is where those emissions live.
 */
const excludedIndirectFor = (ctx: ReportContext): number => {
  const result = ctx.calculationResult!;
  return round(result.indirectElectricityCo2e + result.indirectSteamCo2e, 2);
};

export const computeUkCbamFinancialImpact = (ctx: ReportContext): UkCbamFinancialImpact => {
  const reportReference = reportReferenceNumber(ctx, "CBAM");

  // Electricity is in scope for EU CBAM and out of scope for the UK's — the
  // one sector-level difference between the regimes, and the reason this
  // can't be a shared code path with a different price plugged in.
  if (!isUkCbamSector(ctx.sector)) {
    return {
      status: "OUT_OF_SCOPE",
      reportReference,
      reason: `${ctx.sector} is not a UK CBAM sector. UK CBAM covers aluminium, cement, fertilisers, hydrogen and iron & steel; electricity is excluded.`,
    };
  }

  const result = ctx.calculationResult!;
  const emissionsTco2e = result.totalEmissionsUkCbamAr5;
  const specificEmbeddedEmissions = result.specificEmbeddedEmissionsUkCbam;
  const excludedIndirectTco2e = excludedIndirectFor(ctx);

  // No rate published yet means no liability can be stated. Returning the
  // emissions with an explicit pending status — rather than a zero, or a
  // liability computed off some placeholder — is the entire reason
  // getUkCbamRate() is nullable.
  const rate = getUkCbamRate();
  if (!rate) {
    return {
      status: "RATE_PENDING",
      reportReference,
      emissionsTco2e: round(emissionsTco2e, 2),
      specificEmbeddedEmissions: round(specificEmbeddedEmissions),
      includedScopes: UK_CBAM_INCLUDED_EMISSION_SCOPES,
      excludedIndirectTco2e,
      reason:
        "The UK CBAM rate has not been published yet. Emissions are final; the liability can be stated once HMRC publishes the rate for this accounting period and it is entered in the Emission Factor Manager.",
    };
  }

  const grossLiabilityGbp = emissionsTco2e * rate.ratePerTonneGbp;

  // Adjustment for a carbon price already paid overseas on these goods,
  // mirroring the EU's Article 9 deduction: the tonnes it covers are valued
  // at the UK rate and capped at the liability, so paying a higher overseas
  // price than the UK rate cannot produce a negative liability or a refund.
  const carbonPricePaidGbpPerTonne = ctx.carbonPricePaidGbpPerTonne ?? 0;
  const overseasCarbonPriceDeductionTco2e =
    carbonPricePaidGbpPerTonne > 0
      ? Math.min(emissionsTco2e, (carbonPricePaidGbpPerTonne * emissionsTco2e) / rate.ratePerTonneGbp)
      : 0;
  const overseasCarbonPriceDeductionGbp = overseasCarbonPriceDeductionTco2e * rate.ratePerTonneGbp;
  const netLiabilityGbp = Math.max(0, grossLiabilityGbp - overseasCarbonPriceDeductionGbp);

  return {
    status: "CALCULATED",
    reportReference,

    emissionsTco2e: round(emissionsTco2e, 2),
    specificEmbeddedEmissions: round(specificEmbeddedEmissions),
    includedScopes: UK_CBAM_INCLUDED_EMISSION_SCOPES,
    excludedIndirectTco2e,

    rateGbpPerTonne: rate.ratePerTonneGbp,
    rateQuarter: rate.quarterLabel,
    rateAsOfDate: rate.asOfDate,
    rateSource: rate.source,

    grossLiabilityGbp: round(grossLiabilityGbp, 2),
    carbonPricePaidGbpPerTonne,
    overseasCarbonPriceDeductionTco2e: round(overseasCarbonPriceDeductionTco2e, 2),
    overseasCarbonPriceDeductionGbp: round(overseasCarbonPriceDeductionGbp, 2),
    netLiabilityGbp: round(netLiabilityGbp, 2),
  };
};

/** Re-exported for callers that need to explain the exclusion without importing the reference data directly. */
export const UK_CBAM_INDIRECT_DEFERRAL = UK_CBAM_DEFERRED_EMISSIONS;
