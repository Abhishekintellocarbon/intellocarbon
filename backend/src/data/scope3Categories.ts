import type { Scope3Category } from "@prisma/client";

/**
 * All 15 GHG Protocol Corporate Value Chain (Scope 3) Standard categories,
 * so the UI can be honest about what's currently calculable rather than
 * silently omitting the other 10.
 *
 * Every category now has a `prismaCategory` — the enum covers all 15 so that
 * relevance can be reported per category and so a "coming soon" card has a
 * stable identifier to key off. `calculable` is the flag that actually gates
 * behaviour: only the 5 Phase 1 categories have arithmetic behind them in
 * scope3Calculation.service.ts, and writing data against any of the other 10
 * is rejected before it reaches the calculation engine.
 */
export interface Scope3CategoryCatalogEntry {
  number: number;
  name: string;
  prismaCategory: Scope3Category;
  calculable: boolean;
}

export const SCOPE3_CATEGORY_CATALOG: Scope3CategoryCatalogEntry[] = [
  { number: 1, name: "Purchased goods and services", prismaCategory: "CAT1_PURCHASED_GOODS_SERVICES", calculable: true },
  { number: 2, name: "Capital goods", prismaCategory: "CAT2_CAPITAL_GOODS", calculable: false },
  {
    number: 3,
    name: "Fuel- and energy-related activities (not in Scope 1 or 2)",
    prismaCategory: "CAT3_FUEL_ENERGY_RELATED",
    calculable: false,
  },
  {
    number: 4,
    name: "Upstream transportation and distribution",
    prismaCategory: "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION",
    calculable: true,
  },
  { number: 5, name: "Waste generated in operations", prismaCategory: "CAT5_WASTE_GENERATED_IN_OPERATIONS", calculable: false },
  { number: 6, name: "Business travel", prismaCategory: "CAT6_BUSINESS_TRAVEL", calculable: true },
  { number: 7, name: "Employee commuting", prismaCategory: "CAT7_EMPLOYEE_COMMUTING", calculable: true },
  { number: 8, name: "Upstream leased assets", prismaCategory: "CAT8_UPSTREAM_LEASED_ASSETS", calculable: false },
  {
    number: 9,
    name: "Downstream transportation and distribution",
    prismaCategory: "CAT9_DOWNSTREAM_TRANSPORT_DISTRIBUTION",
    calculable: false,
  },
  { number: 10, name: "Processing of sold products", prismaCategory: "CAT10_PROCESSING_OF_SOLD_PRODUCTS", calculable: false },
  { number: 11, name: "Use of sold products", prismaCategory: "CAT11_USE_OF_SOLD_PRODUCTS", calculable: true },
  { number: 12, name: "End-of-life treatment of sold products", prismaCategory: "CAT12_END_OF_LIFE_TREATMENT", calculable: false },
  { number: 13, name: "Downstream leased assets", prismaCategory: "CAT13_DOWNSTREAM_LEASED_ASSETS", calculable: false },
  { number: 14, name: "Franchises", prismaCategory: "CAT14_FRANCHISES", calculable: false },
  { number: 15, name: "Investments", prismaCategory: "CAT15_INVESTMENTS", calculable: false },
];

export const SUPPORTED_SCOPE3_CATEGORIES = SCOPE3_CATEGORY_CATALOG.filter((c) => c.calculable);

/**
 * The 5 categories the calculation engine actually implements. Kept as a
 * literal tuple type (rather than derived from the catalog) so TypeScript can
 * still prove the switch in scope3Calculation.service.ts is exhaustive over
 * exactly these five after the enum grew to 15.
 */
export const CALCULABLE_SCOPE3_CATEGORIES = [
  "CAT1_PURCHASED_GOODS_SERVICES",
  "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION",
  "CAT6_BUSINESS_TRAVEL",
  "CAT7_EMPLOYEE_COMMUTING",
  "CAT11_USE_OF_SOLD_PRODUCTS",
] as const;

export type CalculableScope3Category = (typeof CALCULABLE_SCOPE3_CATEGORIES)[number];

export const isCalculableScope3Category = (category: Scope3Category): category is CalculableScope3Category =>
  (CALCULABLE_SCOPE3_CATEGORIES as readonly Scope3Category[]).includes(category);

export const CATEGORY_NUMBER_BY_PRISMA_CATEGORY = Object.fromEntries(
  SCOPE3_CATEGORY_CATALOG.map((c) => [c.prismaCategory, c.number]),
) as Record<Scope3Category, number>;

export const PRISMA_CATEGORY_BY_NUMBER = Object.fromEntries(
  SCOPE3_CATEGORY_CATALOG.map((c) => [c.number, c.prismaCategory]),
) as Record<number, Scope3Category>;
