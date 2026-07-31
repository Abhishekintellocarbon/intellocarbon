import type { Scope3Category } from "@prisma/client";

/**
 * All 15 GHG Protocol Corporate Value Chain (Scope 3) Standard categories,
 * so the UI can be honest about what's currently calculable rather than
 * silently omitting the other 10. `prismaCategory` is set only for the 5
 * Phase 1 categories this module actually calculates — see
 * scope3Calculation.service.ts.
 */
export interface Scope3CategoryCatalogEntry {
  number: number;
  name: string;
  prismaCategory: Scope3Category | null;
}

export const SCOPE3_CATEGORY_CATALOG: Scope3CategoryCatalogEntry[] = [
  { number: 1, name: "Purchased goods and services", prismaCategory: "CAT1_PURCHASED_GOODS_SERVICES" },
  { number: 2, name: "Capital goods", prismaCategory: null },
  { number: 3, name: "Fuel- and energy-related activities (not in Scope 1 or 2)", prismaCategory: null },
  { number: 4, name: "Upstream transportation and distribution", prismaCategory: "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION" },
  { number: 5, name: "Waste generated in operations", prismaCategory: null },
  { number: 6, name: "Business travel", prismaCategory: "CAT6_BUSINESS_TRAVEL" },
  { number: 7, name: "Employee commuting", prismaCategory: "CAT7_EMPLOYEE_COMMUTING" },
  { number: 8, name: "Upstream leased assets", prismaCategory: null },
  { number: 9, name: "Downstream transportation and distribution", prismaCategory: null },
  { number: 10, name: "Processing of sold products", prismaCategory: null },
  { number: 11, name: "Use of sold products", prismaCategory: "CAT11_USE_OF_SOLD_PRODUCTS" },
  { number: 12, name: "End-of-life treatment of sold products", prismaCategory: null },
  { number: 13, name: "Downstream leased assets", prismaCategory: null },
  { number: 14, name: "Franchises", prismaCategory: null },
  { number: 15, name: "Investments", prismaCategory: null },
];

export const SUPPORTED_SCOPE3_CATEGORIES = SCOPE3_CATEGORY_CATALOG.filter(
  (c): c is Scope3CategoryCatalogEntry & { prismaCategory: Scope3Category } => c.prismaCategory !== null,
);
