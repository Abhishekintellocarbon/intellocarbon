/**
 * Wire types for the Project Eligibility Screener, mirroring
 * backend/src/services/projectScreenerCalculations.ts. The screening itself is
 * computed server-side — the same arrangement as the IntelloCalc tools, where
 * POST /api/leads returns the results alongside the saved lead.
 */

export type ProjectType =
  | "RENEWABLE_ENERGY"
  | "FORESTRY_AFFORESTATION"
  | "BIOCHAR"
  | "BIOGAS_LANDFILL_GAS"
  | "ENHANCED_ROCK_WEATHERING"
  | "INDUSTRIAL_ENERGY_EFFICIENCY"
  | "OTHER";

export type ScaleBand = "MICRO" | "SMALL" | "MEDIUM" | "LARGE";
export type ProjectStage = "CONCEPT" | "PLANNING" | "UNDER_CONSTRUCTION" | "OPERATIONAL";

export interface ProjectScreenerInputs {
  projectType: ProjectType;
  state: string;
  scaleBand: ScaleBand;
  stage: ProjectStage;
  projectDescription?: string;
}

export type MitigationType = "AVOIDANCE" | "REMOVAL";
export type InterventionType = "NATURE_BASED" | "ENGINEERED";

export interface VcmCategory {
  mitigationType: MitigationType;
  interventionType: InterventionType;
  label: string;
  rationale: string;
}

export type RegistryTrack = "DOMESTIC_ICM" | "INTERNATIONAL" | "EITHER" | "UNDETERMINED";

export interface RegistryFit {
  track: RegistryTrack;
  label: string;
  rationale: string;
  candidates: string[];
}

export interface ScreenerConsideration {
  heading: string;
  detail: string;
}

export interface ProjectScreenerResults {
  /** Null when the project type is "Other" — reported as uncategorised rather than guessed. */
  category: VcmCategory | null;
  registryFit: RegistryFit;
  considerations: ScreenerConsideration[];
  methodologyNote: string;
  disclaimer: string;
}
