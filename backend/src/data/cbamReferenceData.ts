/**
 * Reference data for the CBAM Communication Package PDF (see
 * `services/cbamReport/`). These follow the same convention as
 * `emissionFactors.ts` / `gwpTables.ts`: real published figures where known,
 * an explicit source citation, and a clear "illustrative / confirm before
 * submission" label wherever the exact figure depends on inputs this platform
 * doesn't capture (the precise CN code, the Commission's most recent quarterly
 * publication, etc). Nothing here is presented as a certified compliance value.
 */

import type { ProductionRoute } from "@prisma/client";

export interface CbamCertificatePriceReference {
  pricePerTonneEur: number;
  quarterLabel: string;
  asOfDate: string;
  source: string;
}

/**
 * Indicative CBAM certificate reference price.
 *
 * Under Regulation (EU) 2023/956 Article 21, the Commission calculates and
 * publishes the average weekly closing price of EU ETS allowances as the
 * CBAM certificate price — but certificate *sales* only open from February
 * 2027 (definitive regime), so no official weekly CBAM print exists yet for
 * a report dated in 2026. This figure is an indicative stand-in based on
 * the recent EU ETS (EUA) secondary-market average, used for estimating
 * prospective liability. Replace with the Commission's official weekly
 * average once published.
 */
export const CBAM_CERTIFICATE_PRICE: CbamCertificatePriceReference = {
  pricePerTonneEur: 72.5,
  quarterLabel: "Q2 2026",
  asOfDate: "2026-04-01",
  source:
    "Indicative reference price based on EU ETS (EUA) secondary-market average — stand-in for the Commission's official weekly CBAM certificate price under Regulation (EU) 2023/956 Article 21, which begins publication only once certificate sales open (February 2027).",
};

export interface EuDefaultSeeReference {
  valueTco2ePerTonne: number;
  source: string;
}

/**
 * Illustrative EU default Specific Embedded Emissions (SEE) values by
 * production route, standing in for the CN-code-specific default values the
 * Commission publishes under its CBAM default-values implementing act
 * (referenced here as Commission Implementing Regulation (EU) 2025/2621).
 * Actual defaults vary by exact CN code and are markedly route-dependent
 * (integrated BF-BOF routes carry far higher embedded emissions than
 * scrap-based EAF routes) — confirm the applicable value for the declared
 * CN code against the Commission's current publication before relying on
 * this for a regulatory submission.
 */
export const EU_DEFAULT_SEE_BY_ROUTE: Record<ProductionRoute, EuDefaultSeeReference> = {
  BF_BOF: {
    valueTco2ePerTonne: 2.05,
    source:
      "Illustrative default for the integrated (BF-BOF) route — confirm against Commission Implementing Regulation (EU) 2025/2621 default value for the declared CN code.",
  },
  DRI_EAF: {
    valueTco2ePerTonne: 1.35,
    source:
      "Illustrative default for the DRI-EAF route — confirm against Commission Implementing Regulation (EU) 2025/2621 default value for the declared CN code.",
  },
  EAF: {
    valueTco2ePerTonne: 0.45,
    source:
      "Illustrative default for the scrap-based EAF route — confirm against Commission Implementing Regulation (EU) 2025/2621 default value for the declared CN code.",
  },
  OTHER: {
    valueTco2ePerTonne: 1.9,
    source:
      "Illustrative generic default (route unspecified) — confirm against Commission Implementing Regulation (EU) 2025/2621 default value for the declared CN code.",
  },
};

/** Human-readable CBAM activity / Annex I goods-category label, derived from production route — not a stored field. */
export const CBAM_ACTIVITY_BY_ROUTE: Record<ProductionRoute, string> = {
  BF_BOF: "Iron and steel — Basic Oxygen Furnace (integrated BF-BOF) steelmaking",
  EAF: "Iron and steel — Electric Arc Furnace (EAF) steelmaking",
  DRI_EAF: "Iron and steel — Direct Reduced Iron + Electric Arc Furnace steelmaking",
  OTHER: "Iron and steel production",
};
