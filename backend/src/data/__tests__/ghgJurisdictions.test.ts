import { describe, expect, it } from "vitest";
import { GHG_JURISDICTIONS, GHG_JURISDICTION_OPTIONS, type GhgJurisdictionKey } from "../ghgJurisdictions";

/**
 * Regulatory guard for the GHG Runner's GWP tables.
 *
 * These numbers are cited by assessment report and table number on the
 * methodology page of every report the Runner produces, so a value that drifts
 * from its own citation is a defensibility problem, not just an arithmetic one.
 * A CH4 GWP of 27.9 shipped here previously — AR6's methane GWP excluding the
 * oxidation-to-CO2 contribution — under a constant named "fossil" and cited as
 * Table 7.15. Nothing caught it because this file had no coverage.
 *
 * Values are pinned by hand from the primary sources, not from the module.
 */

const AR6_JURISDICTIONS: GhgJurisdictionKey[] = ["US_CALIFORNIA", "AUSTRALIA"];
const AR5_JURISDICTIONS: GhgJurisdictionKey[] = ["UK", "EU", "UAE_MIDDLE_EAST", "OTHER_GHG_PROTOCOL"];

describe("GHG Runner GWP tables", () => {
  it("AR6 uses Table 7.15 fossil methane (29.8), not the 27.9 ex-oxidation figure", () => {
    // IPCC AR6 WG1 Ch.7 Table 7.15: CH4 fossil 29.8, CH4 non-fossil 27.0, N2O 273.
    // Scope 1 here is fuel combustion, so the fossil column is the applicable one.
    const gwp = GHG_JURISDICTIONS.US_CALIFORNIA.gwp;
    expect(gwp.scheme).toBe("AR6");
    expect(gwp.co2).toBe(1);
    expect(gwp.ch4).toBe(29.8);
    expect(gwp.n2o).toBe(273);
  });

  it("AR5 keeps its own values and is not silently upgraded to AR6", () => {
    // IPCC AR5 WG1 Ch.8 Table 8.A.1: CH4 28, N2O 265.
    const gwp = GHG_JURISDICTIONS.UK.gwp;
    expect(gwp.scheme).toBe("AR5");
    expect(gwp.co2).toBe(1);
    expect(gwp.ch4).toBe(28);
    expect(gwp.n2o).toBe(265);
  });

  it.each(AR6_JURISDICTIONS)("%s reports on AR6", (key) => {
    expect(GHG_JURISDICTIONS[key].gwp.scheme).toBe("AR6");
  });

  it.each(AR5_JURISDICTIONS)("%s reports on AR5", (key) => {
    expect(GHG_JURISDICTIONS[key].gwp.scheme).toBe("AR5");
  });

  it("every jurisdiction cites a source matching the scheme it applies", () => {
    for (const config of GHG_JURISDICTION_OPTIONS) {
      expect(config.gwpSource).toContain(config.gwp.scheme);
      expect(config.regulationLabel.length).toBeGreaterThan(0);
    }
  });

  it("CO2 is 1 by definition on every table", () => {
    for (const config of GHG_JURISDICTION_OPTIONS) {
      expect(config.gwp.co2).toBe(1);
    }
  });
});
