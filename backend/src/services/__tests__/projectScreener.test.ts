import { describe, it, expect } from "vitest";
import { calculateProjectScreener } from "../projectScreenerCalculations";
import type { ProjectScreenerInputs } from "../../validators/leadCapture.validators";

const inputs = (overrides: Partial<ProjectScreenerInputs> = {}): ProjectScreenerInputs => ({
  projectType: "RENEWABLE_ENERGY",
  state: "Maharashtra",
  scaleBand: "MEDIUM",
  stage: "PLANNING",
  ...overrides,
});

/**
 * The screener's value is entirely in what it refuses to assert, so these pin
 * the refusals as much as the categorisations.
 */
describe("VCM category placement", () => {
  it("places each project type in the right quadrant of the 2x2", () => {
    const quadrant = (projectType: ProjectScreenerInputs["projectType"]) => {
      const { category } = calculateProjectScreener(inputs({ projectType }));
      return category && `${category.mitigationType}/${category.interventionType}`;
    };

    expect(quadrant("RENEWABLE_ENERGY")).toBe("AVOIDANCE/ENGINEERED");
    expect(quadrant("FORESTRY_AFFORESTATION")).toBe("REMOVAL/NATURE_BASED");
    expect(quadrant("INDUSTRIAL_ENERGY_EFFICIENCY")).toBe("AVOIDANCE/ENGINEERED");
    expect(quadrant("ENHANCED_ROCK_WEATHERING")).toBe("REMOVAL/ENGINEERED");
  });

  it("treats biochar as an engineered removal, not a nature-based one", () => {
    // Biogenic feedstock, but pyrolysis is what creates the durable carbon —
    // the common miscategorisation is to call this nature-based.
    const { category } = calculateProjectScreener(inputs({ projectType: "BIOCHAR" }));
    expect(category?.mitigationType).toBe("REMOVAL");
    expect(category?.interventionType).toBe("ENGINEERED");
  });

  it("treats methane capture as avoidance, not removal", () => {
    // Preventing a release is not the same as taking carbon out of the air.
    const { category } = calculateProjectScreener(inputs({ projectType: "BIOGAS_LANDFILL_GAS" }));
    expect(category?.mitigationType).toBe("AVOIDANCE");
  });

  it("refuses to categorise an unlisted project type rather than guessing", () => {
    const result = calculateProjectScreener(inputs({ projectType: "OTHER" }));
    expect(result.category).toBeNull();
    expect(result.registryFit.track).toBe("UNDETERMINED");
    expect(result.registryFit.candidates).toEqual([]);
  });
});

describe("registry track", () => {
  it("names real registries for a categorisable project", () => {
    const { registryFit } = calculateProjectScreener(inputs({ projectType: "FORESTRY_AFFORESTATION" }));
    expect(registryFit.track).toBe("INTERNATIONAL");
    expect(registryFit.candidates.length).toBeGreaterThan(0);
  });

  it("never claims a specific ICM methodology exists for a project type", () => {
    // The domestic mechanism's methodologies are still being notified sector
    // by sector; the copy may point at the track but must not assert coverage.
    for (const projectType of ["RENEWABLE_ENERGY", "BIOGAS_LANDFILL_GAS", "INDUSTRIAL_ENERGY_EFFICIENCY"] as const) {
      const { registryFit, considerations } = calculateProjectScreener(inputs({ projectType }));
      expect(registryFit.rationale).not.toMatch(/notified methodolog/i);
      expect(considerations.some((c) => /still expanding|currently notified/i.test(`${c.heading} ${c.detail}`))).toBe(true);
    }
  });
});

describe("stage and scale guidance", () => {
  it("flags an operational project as the constrained case, not the easy one", () => {
    const { considerations } = calculateProjectScreener(inputs({ stage: "OPERATIONAL" }));
    const stageItem = considerations.find((c) => c.heading.startsWith("Stage"));
    expect(stageItem?.detail).toMatch(/start-date rules/i);
    expect(stageItem?.detail).toMatch(/before the investment decision/i);
  });

  it("points micro and small projects at grouped registration", () => {
    for (const scaleBand of ["MICRO", "SMALL"] as const) {
      const { considerations } = calculateProjectScreener(inputs({ scaleBand }));
      expect(considerations.some((c) => /programmatic or grouped/i.test(c.detail))).toBe(true);
    }
  });

  it("always warns against double counting a compliance reduction", () => {
    const { considerations } = calculateProjectScreener(inputs());
    expect(considerations.some((c) => /cannot be counted twice/i.test(c.heading))).toBe(true);
  });
});

describe("framing", () => {
  it("cites the standard for the categorisation logic and no individual's credential", () => {
    const { methodologyNote } = calculateProjectScreener(inputs());
    expect(methodologyNote).toBe(
      "Categorization logic follows ISO 14064-2 project-level GHG quantification principles.",
    );
  });

  it("carries the indicative-only disclaimer on every result", () => {
    for (const projectType of ["RENEWABLE_ENERGY", "OTHER"] as const) {
      const { disclaimer } = calculateProjectScreener(inputs({ projectType }));
      expect(disclaimer).toBe(
        "This is an indicative screening tool only. Actual project eligibility depends on detailed methodology-specific assessment by the relevant registry.",
      );
    }
  });
});
