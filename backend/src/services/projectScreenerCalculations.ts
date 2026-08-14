import type { ProjectScreenerInputs } from "../validators/leadCapture.validators";

/**
 * Indicative screening for voluntary carbon market projects.
 *
 * Scope boundary, stated once here because everything below depends on it:
 * this has nothing to do with CCTS. CCTS is a *compliance* mechanism for
 * formally obligated entities reducing the emissions intensity of their own
 * operations against a BEE-notified target — see cctsMarketPosition.service.ts
 * for that. This file screens *projects* that generate credits in the
 * voluntary market, which is a separate mechanism with separate registries,
 * separate methodologies and separate buyers. The two are deliberately not
 * modelled together.
 *
 * Everything returned here is indicative. Real eligibility is decided by a
 * registry against a specific methodology, and no output of this function
 * should be presented as an eligibility determination. That is why the result
 * type carries no score, no percentage and no yes/no verdict — only a likely
 * category, a likely registry track, and the questions a developer would then
 * have to answer properly.
 *
 * Categorisation follows the project-level GHG quantification principles of
 * ISO 14064-2 — the standard is cited, and no individual's credential is.
 */

export type ProjectType =
  | "RENEWABLE_ENERGY"
  | "FORESTRY_AFFORESTATION"
  | "BIOCHAR"
  | "BIOGAS_LANDFILL_GAS"
  | "ENHANCED_ROCK_WEATHERING"
  | "INDUSTRIAL_ENERGY_EFFICIENCY"
  | "OTHER";

/** The voluntary market's standard 2x2: what the project does, and how it does it. */
export type MitigationType = "AVOIDANCE" | "REMOVAL";
export type InterventionType = "NATURE_BASED" | "ENGINEERED";

export interface VcmCategory {
  mitigationType: MitigationType;
  interventionType: InterventionType;
  /** e.g. "Engineered removal" — the quadrant named as buyers name it. */
  label: string;
  rationale: string;
}

export type RegistryTrack = "DOMESTIC_ICM" | "INTERNATIONAL" | "EITHER" | "UNDETERMINED";

export interface RegistryFit {
  track: RegistryTrack;
  label: string;
  rationale: string;
  /** Named registries a developer would actually approach, or empty when undetermined. */
  candidates: string[];
}

export interface ScreenerConsideration {
  heading: string;
  detail: string;
}

export interface ProjectScreenerResults {
  /** Null for OTHER — an uncategorised project type is reported as such, never guessed into a quadrant. */
  category: VcmCategory | null;
  registryFit: RegistryFit;
  considerations: ScreenerConsideration[];
  methodologyNote: string;
  disclaimer: string;
}

export const SCREENER_DISCLAIMER =
  "This is an indicative screening tool only. Actual project eligibility depends on detailed methodology-specific assessment by the relevant registry.";

const METHODOLOGY_NOTE =
  "Categorization logic follows ISO 14064-2 project-level GHG quantification principles.";

/**
 * The 2x2 placement per project type.
 *
 * Two of these are worth the reader's attention because they are commonly
 * miscategorised. Biochar is a removal, not an avoidance — the carbon is
 * biogenic, but pyrolysis converts it to a durable form, so it sits on the
 * engineered side despite the feedstock being biological. Biogas and landfill
 * gas are avoidance rather than removal: capturing methane prevents a release
 * that would otherwise have happened, but takes nothing out of the atmosphere.
 */
const CATEGORY_BY_TYPE: Record<Exclude<ProjectType, "OTHER">, VcmCategory> = {
  RENEWABLE_ENERGY: {
    mitigationType: "AVOIDANCE",
    interventionType: "ENGINEERED",
    label: "Engineered avoidance",
    rationale:
      "Generation displaces fossil-fuelled grid supply, so the credit represents emissions that were prevented rather than carbon taken out of the atmosphere.",
  },
  FORESTRY_AFFORESTATION: {
    mitigationType: "REMOVAL",
    interventionType: "NATURE_BASED",
    label: "Nature-based removal",
    rationale:
      "Biological growth sequesters atmospheric carbon. Durability is governed by the permanence and reversal-risk provisions of the applicable methodology.",
  },
  BIOCHAR: {
    mitigationType: "REMOVAL",
    interventionType: "ENGINEERED",
    label: "Engineered removal",
    rationale:
      "Biogenic feedstock, but pyrolysis converts it into a durable carbon form — which is why biochar is treated as a removal on the engineered side rather than as a nature-based one.",
  },
  BIOGAS_LANDFILL_GAS: {
    mitigationType: "AVOIDANCE",
    interventionType: "ENGINEERED",
    label: "Engineered avoidance",
    rationale:
      "Capturing methane prevents a release that would otherwise have occurred. Nothing is removed from the atmosphere, so this is avoidance despite the high warming potential of the gas involved.",
  },
  ENHANCED_ROCK_WEATHERING: {
    mitigationType: "REMOVAL",
    interventionType: "ENGINEERED",
    label: "Engineered removal",
    rationale:
      "Accelerates a geochemical reaction that binds atmospheric CO2 into mineral form. Quantification depends heavily on measurement of the weathering rate actually achieved.",
  },
  INDUSTRIAL_ENERGY_EFFICIENCY: {
    mitigationType: "AVOIDANCE",
    interventionType: "ENGINEERED",
    label: "Engineered avoidance",
    rationale:
      "Reduced energy demand prevents the emissions that supplying it would have caused. Note that where the same facility is a CCTS-obligated entity, the reduction may already count towards its compliance target and cannot also be sold as a voluntary credit.",
  },
};

/**
 * Which registry track a project type tends to fit.
 *
 * A deliberate restraint: India's ICM offset mechanism is having its
 * methodologies notified sector by sector, so this never asserts that a
 * specific methodology exists for a given project type today. It says which
 * track is worth approaching and tells the developer to confirm the current
 * notified list — which is the honest answer while that list is still moving.
 */
const REGISTRY_FIT_BY_TYPE: Record<Exclude<ProjectType, "OTHER">, RegistryFit> = {
  RENEWABLE_ENERGY: {
    track: "EITHER",
    label: "Either track may fit",
    rationale:
      "Renewable generation is long-established in the international registries, and is among the sectors the domestic offset mechanism has been developed around. Note that grid-connected renewables face additionality scrutiny in the international registries where the technology is already commercially standard.",
    candidates: ["India ICM (domestic offset mechanism)", "Verra VCS", "Gold Standard"],
  },
  FORESTRY_AFFORESTATION: {
    track: "INTERNATIONAL",
    label: "International track more likely",
    rationale:
      "Afforestation and reforestation have deep, well-tested methodology coverage in the international registries, including the permanence, buffer-pool and reversal-risk machinery these projects require.",
    candidates: ["Verra VCS", "Gold Standard"],
  },
  BIOCHAR: {
    track: "INTERNATIONAL",
    label: "International track more likely",
    rationale:
      "Durable-removal methodologies for biochar are established internationally, and buyer demand for engineered removals is concentrated there.",
    candidates: ["Verra VCS", "Gold Standard"],
  },
  BIOGAS_LANDFILL_GAS: {
    track: "EITHER",
    label: "Either track may fit",
    rationale:
      "Methane capture is well covered internationally and is a natural fit for a domestic waste-sector track. Which one suits better usually turns on where the offtake demand is rather than on the technology.",
    candidates: ["India ICM (domestic offset mechanism)", "Verra VCS", "Gold Standard"],
  },
  ENHANCED_ROCK_WEATHERING: {
    track: "INTERNATIONAL",
    label: "International track more likely",
    rationale:
      "A comparatively new durable-removal pathway. Methodology coverage and the buyer base sit with the international registries and specialised removal platforms.",
    candidates: ["Verra VCS", "Gold Standard"],
  },
  INDUSTRIAL_ENERGY_EFFICIENCY: {
    track: "EITHER",
    label: "Either track may fit",
    rationale:
      "Industrial efficiency is a core domestic priority and is also covered internationally. The deciding question is usually whether the same reduction is already committed to a compliance obligation.",
    candidates: ["India ICM (domestic offset mechanism)", "Verra VCS", "Gold Standard"],
  },
};

const UNDETERMINED_REGISTRY_FIT: RegistryFit = {
  track: "UNDETERMINED",
  label: "Cannot be indicated from this input",
  rationale:
    "The project type was given as 'Other', and registry fit follows from the specific activity being undertaken. Describe the activity when you get in touch and it can be screened properly.",
  candidates: [],
};

/**
 * Scale bands. Kept as bands rather than a free number because the screening
 * question they answer — whether a project is likely to stand alone or need
 * aggregation — is itself a banded question, and a spurious exact figure would
 * imply a precision the screening does not have.
 */
export type ScaleBand = "MICRO" | "SMALL" | "MEDIUM" | "LARGE";
export type ProjectStage = "CONCEPT" | "PLANNING" | "UNDER_CONSTRUCTION" | "OPERATIONAL";

const scaleConsideration = (band: ScaleBand): ScreenerConsideration => {
  if (band === "MICRO" || band === "SMALL") {
    return {
      heading: "Scale — aggregation likely relevant",
      detail:
        "At this scale, validation and verification costs often exceed what a standalone project can carry. Registries provide programmatic or grouped approaches that let several small activities share one registration, which is usually the route worth examining first.",
    };
  }
  if (band === "MEDIUM") {
    return {
      heading: "Scale — standalone registration usually viable",
      detail:
        "This scale can typically support the cost of its own validation and verification cycle, though a grouped approach may still be more economical if you are developing several similar projects.",
    };
  }
  return {
    heading: "Scale — standalone registration viable",
    detail:
      "At this scale the fixed costs of registration, validation and periodic verification are usually a small share of project value. Expect correspondingly closer scrutiny of the baseline and of additionality.",
  };
};

/**
 * The prior-consideration problem, which is the single most common reason a
 * developer discovers too late that their project cannot be registered.
 * Registries generally require evidence that carbon revenue was considered
 * before the investment decision, so an already-built project is the hardest
 * case, not the easiest — which is the opposite of what most people expect.
 */
const stageConsideration = (stage: ProjectStage): ScreenerConsideration => {
  switch (stage) {
    case "CONCEPT":
    case "PLANNING":
      return {
        heading: "Stage — best point to start",
        detail:
          "Registries generally require evidence that carbon revenue was considered before the investment decision was taken. Starting now means that evidence can be created contemporaneously rather than reconstructed, which is the single most common obstacle to registration later.",
      };
    case "UNDER_CONSTRUCTION":
      return {
        heading: "Stage — act before commissioning",
        detail:
          "Prior consideration of carbon revenue must usually be evidenced from before the investment decision, and start-date rules limit how far back a crediting period can reach. Both are easier to satisfy now than after the project is operating.",
      };
    case "OPERATIONAL":
      return {
        heading: "Stage — retroactive registration is constrained",
        detail:
          "An operating project is the hardest case, not the easiest: registries apply start-date rules limiting how far back crediting can reach, and require evidence that carbon revenue was considered before the investment decision. Neither is impossible to satisfy, but both need checking against the specific methodology before any development cost is committed.",
      };
  }
};

export const calculateProjectScreener = (inputs: ProjectScreenerInputs): ProjectScreenerResults => {
  const category = inputs.projectType === "OTHER" ? null : CATEGORY_BY_TYPE[inputs.projectType];
  const registryFit =
    inputs.projectType === "OTHER" ? UNDETERMINED_REGISTRY_FIT : REGISTRY_FIT_BY_TYPE[inputs.projectType];

  const considerations: ScreenerConsideration[] = [
    scaleConsideration(inputs.scaleBand),
    stageConsideration(inputs.stage),
    {
      // Stated for every project, because the domestic mechanism's methodology
      // set is still being notified and a developer acting on a stale
      // assumption about what is covered would waste real money.
      heading: "Domestic methodology coverage is still expanding",
      detail:
        "India's ICM offset mechanism is having its methodologies notified sector by sector. Confirm the currently notified list for your activity before choosing the domestic track — coverage at the time you register is what governs, not coverage at the time of this screening.",
    },
    {
      heading: "One reduction cannot be counted twice",
      detail:
        "A reduction already counted towards a compliance obligation — a CCTS intensity target, for instance — cannot also be sold as a voluntary credit. Where a site carries both, the boundary between the two has to be drawn explicitly before either is claimed.",
    },
  ];

  return {
    category,
    registryFit,
    considerations,
    methodologyNote: METHODOLOGY_NOTE,
    disclaimer: SCREENER_DISCLAIMER,
  };
};
