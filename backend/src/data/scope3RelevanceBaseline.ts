import type { Scope3Relevance, Sector } from "@prisma/client";

/**
 * Sector-level materiality baseline for all 15 GHG Protocol Scope 3
 * categories, following the screening guidance in the GHG Protocol Corporate
 * Value Chain (Scope 3) Standard (Ch. 6, "Identifying relevant activities").
 *
 * This is the *sector* answer only. Five categories additionally depend on
 * facts about the individual company rather than its sector — 8 and 13 on
 * Company.ownershipModel, 9, 14 and 15 on Company.businessModel — and those
 * are layered on top by scope3Relevance.service.ts, which also replaces
 * `reasoning` when an override fires. The rows seeded here are the
 * no-override state, i.e. what an OWNED / MANUFACTURER company sees.
 *
 * Seeded into Scope3CategoryRelevance by prisma/seed.ts, keyed on
 * (sector, category) so reseeding is idempotent.
 */
export interface Scope3RelevanceBaselineRow {
  sector: Sector;
  category: number;
  relevance: Scope3Relevance;
  reasoning: string;
}

const ALL_SECTORS: Sector[] = ["STEEL", "CEMENT", "ALUMINIUM", "FERTILIZER", "HYDROGEN", "ELECTRICITY", "OTHER"];

/** Categories whose relevance is identical across every sector we serve. */
const SECTOR_INVARIANT: { category: number; relevance: Scope3Relevance; reasoning: string }[] = [
  {
    category: 1,
    relevance: "MANDATORY",
    reasoning:
      "Purchased goods and services is the largest upstream source for every industrial sector — raw materials, ores, refractories and bought-in services routinely dominate the Scope 3 inventory.",
  },
  {
    category: 2,
    relevance: "OPTIONAL",
    reasoning:
      "Capital goods are lumpy and infrequent for an operating plant. Report when a major capex cycle falls inside the reporting year; otherwise the embodied emissions are immaterial year to year.",
  },
  {
    category: 3,
    relevance: "MANDATORY",
    reasoning:
      "Well-to-tank and transmission-and-distribution losses on the fuel and grid electricity already counted in Scope 1 and 2 are always material for an energy-intensive site, and follow directly from data you already hold.",
  },
  {
    category: 4,
    relevance: "MANDATORY",
    reasoning:
      "Inbound raw material and outbound finished goods freight is material for bulk industrial commodities, where tonnage moved per rupee of output is high.",
  },
  {
    category: 5,
    relevance: "MANDATORY",
    reasoning:
      "Process waste, slag, ash and effluent treatment are material for industrial operations and are already tracked for state pollution control board returns.",
  },
  {
    category: 6,
    relevance: "OPTIONAL",
    reasoning:
      "Business travel is rarely material against process emissions at an industrial site, but it is cheap to report and is commonly requested by investors and buyers.",
  },
  {
    category: 7,
    relevance: "OPTIONAL",
    reasoning:
      "Employee commuting is typically well under 1% of an industrial company's value-chain footprint, so it is reported for completeness rather than materiality.",
  },
  {
    category: 11,
    relevance: "MANDATORY",
    reasoning:
      "Use-phase emissions of sold products must be assessed wherever products consume energy or release GHGs in use; the GHG Protocol treats this as a required screening category.",
  },
  {
    category: 12,
    relevance: "MANDATORY",
    reasoning:
      "End-of-life treatment of sold products completes the cradle-to-grave boundary that BRSR Core and ISSB S2 both expect for a manufactured product.",
  },
];

/**
 * Category 10 — processing of sold products. Material only where output is an
 * intermediate good that a downstream customer processes further, which is
 * exactly the distinction between a commodity input and a finished good.
 */
const CATEGORY_10_BY_SECTOR: Record<Sector, { relevance: Scope3Relevance; reasoning: string }> = {
  STEEL: {
    relevance: "MANDATORY",
    reasoning:
      "Crude and semi-finished steel is an intermediate good — rolling, forming and fabrication by downstream customers are material and attributable to the producer.",
  },
  CEMENT: {
    relevance: "MANDATORY",
    reasoning:
      "Clinker and cement are intermediate goods further processed into concrete by ready-mix and construction customers.",
  },
  ALUMINIUM: {
    relevance: "MANDATORY",
    reasoning:
      "Primary aluminium ingot and billet are intermediate goods — downstream extrusion, rolling and casting are material processing steps.",
  },
  HYDROGEN: {
    relevance: "MANDATORY",
    reasoning:
      "Hydrogen is sold as an industrial feedstock and is processed further by refining, ammonia and steel customers rather than consumed as a finished good.",
  },
  FERTILIZER: {
    relevance: "NOT_APPLICABLE",
    reasoning:
      "Fertilizer is sold as a finished good applied directly by the end user — there is no downstream processing step to attribute.",
  },
  ELECTRICITY: {
    relevance: "NOT_APPLICABLE",
    reasoning:
      "Electricity is consumed as delivered, not processed into another product; its downstream impact is captured under Category 11 instead.",
  },
  OTHER: {
    relevance: "OPTIONAL",
    reasoning:
      "Whether sold products are processed further depends on this company's specific product mix — assess and report if output is an intermediate good.",
  },
};

/**
 * Baselines for the five company-attribute-driven categories. These are the
 * values a company sees when its ownershipModel is OWNED and its
 * businessModel is MANUFACTURER; scope3Relevance.service.ts overrides them
 * from the company record.
 */
const ATTRIBUTE_DRIVEN_BASELINE: { category: number; relevance: Scope3Relevance; reasoning: string }[] = [
  {
    category: 8,
    relevance: "NOT_APPLICABLE",
    reasoning: "Not applicable — no leased assets on record. Set the company's ownership model to Leased or Mixed if that changes.",
  },
  {
    category: 9,
    relevance: "MANDATORY",
    reasoning:
      "As a manufacturer you control the point of sale, so onward distribution, warehousing and retail of sold products is attributable and material.",
  },
  {
    category: 13,
    relevance: "NOT_APPLICABLE",
    reasoning: "Not applicable — no leased assets on record. Set the company's ownership model to Leased or Mixed if that changes.",
  },
  {
    category: 14,
    relevance: "NOT_APPLICABLE",
    reasoning: "Not applicable — this category only applies to franchisors, and the company's business model is not set to Franchisor.",
  },
  {
    category: 15,
    relevance: "NOT_APPLICABLE",
    reasoning:
      "Not applicable — this category only applies to financial institutions, and the company's business model is not set to Financial institution.",
  },
];

export const SCOPE3_RELEVANCE_BASELINE: Scope3RelevanceBaselineRow[] = ALL_SECTORS.flatMap((sector) => [
  ...SECTOR_INVARIANT.map((row) => ({ sector, ...row })),
  { sector, category: 10, ...CATEGORY_10_BY_SECTOR[sector] },
  ...ATTRIBUTE_DRIVEN_BASELINE.map((row) => ({ sector, ...row })),
]);
