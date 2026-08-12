/**
 * Reference data for the UK Carbon Border Adjustment Mechanism, which takes
 * effect 1 January 2027 under the UK's own CBAM legislation — a separate
 * regime from the EU's Regulation (EU) 2023/956, not a variant of it. This
 * file is the UK counterpart to `cbamReferenceData.ts` and follows the same
 * conventions: real published figures where known, an explicit source
 * citation on every value, and no invented placeholders where HMRC has not
 * published yet (the rate, in particular, stays null until configured).
 *
 * Data model and constants only at this stage — nothing here is wired into
 * the calculation engine or the report builders, and the EU CBAM path is
 * untouched.
 */

import type { Sector } from "@prisma/client";

import { UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR } from "./complianceDeadlines";

/**
 * Sectors in scope for UK CBAM from 1 January 2027.
 *
 * Deliberately NOT the same list as EU CBAM: the UK regime covers aluminium,
 * cement, fertilisers, hydrogen and iron & steel, and **excludes electricity**
 * (the EU includes it). Glass and ceramics were consulted on and left out of
 * the initial scope. Keep this list authoritative — `isUkCbamSector()` below
 * is the only thing that should be answering "is this in scope".
 *
 * Source: HM Treasury / HMRC — "Introduction of a UK carbon border adjustment
 * mechanism from January 2027", government response to consultation.
 */
export const UK_CBAM_SECTORS: Sector[] = ["ALUMINIUM", "CEMENT", "FERTILIZER", "HYDROGEN", "STEEL"];

/** Sectors that are in scope for EU CBAM but explicitly out of scope for UK CBAM. */
export const UK_CBAM_EXCLUDED_SECTORS: Sector[] = ["ELECTRICITY"];

export const isUkCbamSector = (sector: Sector): boolean => UK_CBAM_SECTORS.includes(sector);

/**
 * Registration threshold — a person must register for UK CBAM once the value
 * of CBAM goods they import reaches £50,000 over any rolling 12-month period
 * (the test is rolling, not aligned to the accounting period or a tax year,
 * so it must be evaluated on a moving window rather than per calendar year).
 *
 * Source: HMRC — UK CBAM registration threshold, confirmed in the government
 * response to the March 2024 consultation.
 */
export const UK_CBAM_REGISTRATION_THRESHOLD_GBP = 50_000;
export const UK_CBAM_REGISTRATION_THRESHOLD_WINDOW_MONTHS = 12;
export const UK_CBAM_REGISTRATION_THRESHOLD_SOURCE =
  "HMRC — UK CBAM registration threshold: £50,000 of CBAM goods imported over a rolling 12-month period.";

export type UkCbamEmissionScope = "SCOPE_1" | "SCOPE_2" | "SELECT_PRECURSORS";

/**
 * The single source of truth for UK CBAM's emissions boundary: the first
 * accounting period each scope enters the calculation in.
 *
 * Scope 1 (direct) and select precursor emissions are in scope from the
 * 1 Jan 2027 launch. **Scope 2 — indirect, electricity-related emissions —
 * is NOT in scope at launch**; it is deferred to 2029 at the earliest. Every
 * other export in this section is derived from this record, so the boundary
 * can only ever be stated one way and a future phase-in is a one-line change
 * here rather than an edit across several lists.
 *
 * Source: UK Government Policy Paper, November 2025 — UK CBAM emissions
 * scope and the phased introduction of indirect emissions.
 */
const UK_CBAM_EMISSION_SCOPE_START_YEAR: Record<UkCbamEmissionScope, number> = {
  SCOPE_1: UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR,
  SELECT_PRECURSORS: UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR,
  SCOPE_2: 2029,
};

const ALL_UK_CBAM_EMISSION_SCOPES = Object.keys(UK_CBAM_EMISSION_SCOPE_START_YEAR) as UkCbamEmissionScope[];

/** Whether a given scope counts toward UK CBAM emissions for a given accounting period. */
export const isUkCbamEmissionScopeInScope = (scope: UkCbamEmissionScope, accountingPeriodYear: number): boolean =>
  accountingPeriodYear >= UK_CBAM_EMISSION_SCOPE_START_YEAR[scope];

/** Every scope that counts toward UK CBAM emissions for a given accounting period. */
export const ukCbamEmissionScopesFor = (accountingPeriodYear: number): UkCbamEmissionScope[] =>
  ALL_UK_CBAM_EMISSION_SCOPES.filter((scope) => isUkCbamEmissionScopeInScope(scope, accountingPeriodYear));

/**
 * Emissions in scope at launch: Scope 1 + select precursors only.
 *
 * NOTE for the calculation layer, which is not built yet: nothing may compute
 * Scope 2 / indirect electricity-related emissions for UK CBAM before 2029,
 * even though the EU CBAM engine already can — the two regimes' boundaries
 * differ and must not be shared. Anything reasoning about a period other than
 * the launch year should call ukCbamEmissionScopesFor(year) rather than
 * reading this constant.
 */
export const UK_CBAM_INCLUDED_EMISSION_SCOPES: UkCbamEmissionScope[] =
  ukCbamEmissionScopesFor(UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR);

export interface UkCbamDeferredEmissions {
  /** Earliest accounting period in which these emissions may enter the calculation. */
  fromYear: number;
  /** The scopes held back until `fromYear` — Scope 2 is the whole of it today. */
  scopes: UkCbamEmissionScope[];
  description: string;
  source: string;
}

export const UK_CBAM_DEFERRED_EMISSIONS: UkCbamDeferredEmissions = {
  fromYear: UK_CBAM_EMISSION_SCOPE_START_YEAR.SCOPE_2,
  scopes: ALL_UK_CBAM_EMISSION_SCOPES.filter(
    (scope) => !isUkCbamEmissionScopeInScope(scope, UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR),
  ),
  description:
    "Scope 2 — indirect, electricity-related emissions of the imported goods — is not in scope at UK CBAM's 1 January 2027 launch and is deferred to this year at the earliest. Only Scope 1 (direct) and select precursor emissions are calculated before then.",
  source:
    "UK Government Policy Paper, November 2025 — UK CBAM emissions scope, phased introduction of indirect emissions.",
};

/**
 * Whether indirect (Scope 2, electricity-related) emissions count toward UK
 * CBAM for a given accounting period — false for every year before 2029,
 * true from 2029 onward. The same question as
 * isUkCbamEmissionScopeInScope("SCOPE_2", year), kept as a named helper
 * because it is the one scope question callers will keep asking.
 */
export const ukCbamIncludesIndirectEmissions = (accountingPeriodYear: number): boolean =>
  isUkCbamEmissionScopeInScope("SCOPE_2", accountingPeriodYear);

export interface UkCbamRateReference {
  ratePerTonneGbp: number;
  /** Quarter the rate applies to, e.g. "Q1 2027" — HMRC sets the rate quarterly. */
  quarterLabel: string;
  asOfDate: string;
  source: string;
}

/**
 * The UK CBAM rate, pegged to the UK ETS auction price plus Carbon Price
 * Support and set quarterly by HMRC.
 *
 * Null until configured — unlike the EU certificate price, which has a real
 * published figure to seed from, HMRC has published no UK CBAM rate yet, and
 * a made-up placeholder in a liability calculation is worse than no number at
 * all. Populated at runtime from the Emission Factor Manager's "UK CBAM Rate"
 * row exactly as getCbamCertificatePrice() is (see updateUkCbamRate() in
 * services/emissionFactor.service.ts and hydrateEmissionFactorCache(), which
 * seeds it at server startup). Every caller must handle null.
 */
let currentUkCbamRate: UkCbamRateReference | null = null;

export const getUkCbamRate = (): UkCbamRateReference | null => currentUkCbamRate;

/**
 * HMRC sets the UK CBAM rate for the quarter it applies to, so the label is
 * the calendar quarter of `validFrom` itself — no one-quarter-in-arrears
 * offset like the Commission's published reference price (see
 * quarterLabelFor() in cbamReferenceData.ts).
 */
const ukQuarterLabelFor = (date: Date): string =>
  `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;

/** A non-positive value means "not yet published" and clears the rate rather than storing a zero price. */
export const setUkCbamRate = (value: number, source: string, validFrom: Date): void => {
  currentUkCbamRate =
    value > 0
      ? {
          ratePerTonneGbp: value,
          quarterLabel: ukQuarterLabelFor(validFrom),
          asOfDate: validFrom.toISOString().slice(0, 10),
          source,
        }
      : null;
};
