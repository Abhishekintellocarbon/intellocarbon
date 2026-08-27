import { describe, it, expect } from "vitest";
import type { EmissionCalculationResult } from "@prisma/client";
import { buildRecommendationReport, RECOMMENDATION_ENGINE_VERSION } from "../index";
import { buildGridFactorSplit, buildComposition } from "../composition";
import { HIGH_ELECTRICITY_SHARE_PCT, HIGH_SOLID_FUEL_SHARE_PCT } from "../rules";
import { getGridEmissionFactor } from "../../../data/emissionFactors";

/**
 * The engine is a pure function of stored data plus a benchmark table, so these
 * tests need no database and no server — they hand it fabricated calculation
 * rows and pin the output exactly.
 *
 * What is under test is mostly *restraint*. A recommendation engine that emits
 * a plausible number for every facility is easy; the requirement is that it
 * emits nothing when the data does not support a number, and that every figure
 * it does emit traces to either the platform's own calculation or a cited
 * benchmark. Several cases below assert a null and a stated reason rather than
 * a value, and that is the point of them.
 */

const NATIONAL_EF = getGridEmissionFactor();

/** A calculation row with every column present, so tests only state what they care about. */
const calcResult = (over: Partial<EmissionCalculationResult> = {}): EmissionCalculationResult =>
  ({
    id: "calc-1",
    activityDataId: "ad-1",
    directCombustionCo2eAr5: 0,
    directCombustionCo2eAr2Bur3: 0,
    directProcessCo2e: 0,
    directPrecursorCo2e: 0,
    directPfcCo2eAr5: 0,
    directPfcCo2eAr2Bur3: 0,
    directN2oProcessCo2eAr5: 0,
    directN2oProcessCo2eAr2Bur3: 0,
    indirectElectricityCo2e: 0,
    indirectSteamCo2e: 0,
    totalDirectCo2eAr5: 0,
    totalDirectCo2eAr2Bur3: 0,
    totalEmissionsCbamAr5: 0,
    totalEmissionsCctsAr2Bur3: 0,
    specificEmbeddedEmissionsCbam: 0,
    ghgIntensityCcts: 0,
    totalEmissionsUkCbamAr5: 0,
    specificEmbeddedEmissionsUkCbam: 0,
    gridEmissionFactorUsed: NATIONAL_EF,
    breakdown: { fuels: [] },
    calculatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...over,
  }) as EmissionCalculationResult;

const coalFuelLine = (co2e: number) => ({
  fuels: [{ fuelType: "COKING_COAL", label: "Coking coal", co2eAr5: co2e }],
});

const facility = (state: string | null = "Chhattisgarh") => ({
  id: "fac-1",
  name: "Plant A",
  state,
  sector: "STEEL",
});

/** A full reporting year, so annualised consumption equals the period figure. */
const PERIOD = {
  periodStart: new Date("2025-04-01T00:00:00.000Z"),
  periodEnd: new Date("2026-03-31T00:00:00.000Z"),
};

type BillDocumentFixture = {
  id: string;
  billExtraction: {
    status: string;
    state: string | null;
    sanctionedLoadValue: number | null;
    sanctionedLoadUnit: string | null;
    discomName: string | null;
    tariffCode: string | null;
  } | null;
};

/** Defaults to a Chhattisgarh utility, matching the default test facility's state. */
const billDocument = (
  value: number,
  unit = "KVA",
  id = "doc-1",
  status = "COMPLETED",
  state: string | null = "Chhattisgarh",
  discomName = "Chhattisgarh State Power Distribution Co. Ltd. (CSPDCL)",
): BillDocumentFixture => ({
  id,
  billExtraction: { status, state, sanctionedLoadValue: value, sanctionedLoadUnit: unit, discomName, tariffCode: "HT-2" },
});

/** A bill from a utility in a different state to the facility's registered one. */
const outOfStateBill = (value = 2500, id = "doc-1") =>
  billDocument(value, "KVA", id, "COMPLETED", "Maharashtra", "Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)");

/**
 * Electricity-dominated profile: 10,000 MWh of grid supply is 79.6% of a
 * 9,000 tCO2e total, well past the solar trigger, while coal sits at 11% and
 * stays below the fuel-switch trigger so the two rules can be tested apart.
 */
const electricityHeavy = (over: Partial<EmissionCalculationResult> = {}) =>
  calcResult({
    directCombustionCo2eAr5: 1000,
    directProcessCo2e: 500,
    directPrecursorCo2e: 340,
    indirectElectricityCo2e: 10_000 * NATIONAL_EF,
    totalEmissionsCbamAr5: 1000 + 500 + 340 + 10_000 * NATIONAL_EF,
    breakdown: coalFuelLine(1000),
    ...over,
  });

const electricityHeavyActivity = (documents: BillDocumentFixture[] = [billDocument(2500)]) => ({
  id: "ad-1",
  ...PERIOD,
  gridElectricityMwh: 10_000,
  renewableElectricityMwh: 0,
  documents,
});

/** Coal-dominated profile: 7,000 tCO2e of coking coal in an 8,000 tCO2e total. */
const combustionHeavy = () =>
  calcResult({
    directCombustionCo2eAr5: 7000,
    directProcessCo2e: 200,
    directPrecursorCo2e: 84,
    indirectElectricityCo2e: 1000 * NATIONAL_EF,
    totalEmissionsCbamAr5: 7000 + 200 + 84 + 1000 * NATIONAL_EF,
    breakdown: coalFuelLine(7000),
  });

const report = (
  over: Partial<Parameters<typeof buildRecommendationReport>[0]> = {},
): ReturnType<typeof buildRecommendationReport> =>
  buildRecommendationReport({
    facility: facility(),
    activityData: electricityHeavyActivity(),
    calculationResult: electricityHeavy(),
    now: new Date("2026-08-27T00:00:00.000Z"),
    ...over,
  });

const cardById = (r: ReturnType<typeof buildRecommendationReport>, id: string) =>
  r.recommendations.find((c) => c.id === id);

// ---------------------------------------------------------------------------

describe("high electricity share", () => {
  it("produces a solar recommendation with an indicative size and an impact range", () => {
    const r = report();
    const solar = cardById(r, "SOLAR_SELF_GENERATION");

    expect(solar).toBeDefined();
    expect(r.composition!.scope2Electricity.sharePct).toBeGreaterThan(HIGH_ELECTRICITY_SHARE_PCT);
    expect(solar!.impact).not.toBeNull();
    expect(solar!.impact!.unit).toBe("PERCENT_OF_TOTAL_EMISSIONS");
    // Always a range, never a point — a single figure would claim a precision
    // the published yield range does not carry.
    expect(solar!.impact!.high).toBeGreaterThan(solar!.impact!.low);
    expect(solar!.inputs.some((i) => i.label === "Indicative system size")).toBe(true);
  });

  it("cites the yield benchmark and the state's open-access position", () => {
    const solar = cardById(report(), "SOLAR_SELF_GENERATION")!;
    expect(solar.citations.length).toBeGreaterThanOrEqual(2);
    expect(solar.citations.some((c) => /National Institute of Solar Energy|New and Renewable Energy/.test(c.publisher))).toBe(true);
    expect(solar.citations.some((c) => /Chhattisgarh/.test(c.publisher))).toBe(true);
  });

  it("caps the system at the sanctioned load rather than at the offset target", () => {
    // 2,500 kVA against 10,000 MWh/year: a 30% offset would need roughly
    // 2,140 kWp, a 15% offset roughly 940 kWp — both under the cap. Drop the
    // sanctioned load to 500 and the cap has to bind.
    const capped = report({ activityData: electricityHeavyActivity([billDocument(500)]) });
    const solar = cardById(capped, "SOLAR_SELF_GENERATION")!;
    const size = solar.inputs.find((i) => i.label === "Indicative system size")!.value;

    expect(size).toBe("500–500 kWp");
    expect(solar.caveats.some((c) => /capped at the sanctioned load/i.test(c))).toBe(true);
  });

  it("flags that a kVA load is not converted to kW", () => {
    const solar = cardById(report(), "SOLAR_SELF_GENERATION")!;
    expect(solar.caveats.some((c) => /power factor/i.test(c))).toBe(true);
  });

  it("does not fire below the electricity-share threshold", () => {
    const r = report({ calculationResult: combustionHeavy(), activityData: { ...electricityHeavyActivity(), gridElectricityMwh: 1000 } });
    expect(r.composition!.scope2Electricity.sharePct).toBeLessThan(HIGH_ELECTRICITY_SHARE_PCT);
    expect(cardById(r, "SOLAR_SELF_GENERATION")).toBeUndefined();
  });
});

describe("state awareness", () => {
  it("uses the state profile when the state is in the lookup table", () => {
    const solar = cardById(report({ facility: facility("Chhattisgarh") }), "SOLAR_SELF_GENERATION")!;
    expect(solar.explanation).toMatch(/1,000 kW/);
    expect(solar.caveats.some((c) => /cross-subsidy surcharge/i.test(c))).toBe(true);
  });

  it("falls back to the national threshold for a state not yet in the table", () => {
    // The rule must not be Chhattisgarh-shaped: an unlisted state still gets a
    // correct, citable eligibility statement rather than silence or a figure
    // borrowed from a neighbouring state's tariff order.
    const solar = cardById(
      report({
        facility: facility("Odisha"),
        activityData: electricityHeavyActivity([billDocument(2500, "KVA", "doc-1", "COMPLETED", null, "Unknown utility")]),
      }),
      "SOLAR_SELF_GENERATION",
    )!;
    expect(solar.citations.some((c) => /Electricity Act, 2003/.test(c.document))).toBe(true);
    expect(solar.caveats.some((c) => /not yet in the reference table/i.test(c))).toBe(true);
  });

  it("handles a facility with no state recorded and no state on the bill", () => {
    const solar = cardById(
      report({
        facility: facility(null),
        activityData: electricityHeavyActivity([billDocument(2500, "KVA", "doc-1", "COMPLETED", null, "Unknown utility")]),
      }),
      "SOLAR_SELF_GENERATION",
    )!;
    expect(solar.impact).not.toBeNull();
    expect(solar.caveats.some((c) => /No state is recorded/i.test(c))).toBe(true);
  });
});

describe("bill state versus registered state", () => {
  // Open access is a property of the electricity connection, and the bill is
  // what describes the connection. The registered state is an address.
  it("resolves open-access rules against the bill's discom, not the facility's address", () => {
    const r = report({ facility: facility("Chhattisgarh"), activityData: electricityHeavyActivity([outOfStateBill()]) });

    expect(r.billDataUsed.billState).toBe("Maharashtra");
    expect(r.billDataUsed.openAccessStateSource).toBe("BILL_DISCOM");

    const solar = cardById(r, "SOLAR_SELF_GENERATION")!;
    // Maharashtra is not in the profile table, so the national floor applies —
    // proving the bill's state, not Chhattisgarh's CSERC entry, drove this.
    expect(solar.citations.some((c) => /Electricity Act, 2003/.test(c.document))).toBe(true);
    expect(solar.citations.some((c) => /Chhattisgarh/.test(c.publisher))).toBe(false);
  });

  it("reports the mismatch rather than resolving it away", () => {
    const r = report({ facility: facility("Chhattisgarh"), activityData: electricityHeavyActivity([outOfStateBill()]) });

    expect(r.billDataUsed.stateMismatch).not.toBeNull();
    expect(r.billDataUsed.stateMismatch!.billState).toBe("Maharashtra");
    expect(r.billDataUsed.stateMismatch!.facilityState).toBe("Chhattisgarh");
    expect(r.billDataUsed.stateMismatch!.discomName).toMatch(/MSEDCL/);
    expect(r.billDataUsed.stateMismatch!.message).toMatch(/One of the two records is wrong/i);
  });

  it("leads the solar card's caveats with the mismatch", () => {
    // A mismatch can make every figure on the card apply to the wrong regime,
    // so it must not sit third behind tariff detail.
    const solar = cardById(
      report({ facility: facility("Chhattisgarh"), activityData: electricityHeavyActivity([outOfStateBill()]) }),
      "SOLAR_SELF_GENERATION",
    )!;
    expect(solar.caveats[0]).toMatch(/registered in Chhattisgarh/);
  });

  it("says which state the rules were read for, and where that state came from", () => {
    const fromBill = cardById(
      report({ facility: facility("Chhattisgarh"), activityData: electricityHeavyActivity([outOfStateBill()]) }),
      "SOLAR_SELF_GENERATION",
    )!;
    const shownFor = fromBill.inputs.find((i) => i.label === "Open-access rules shown for")!;
    expect(shownFor.value).toMatch(/Maharashtra \(from the utility on your bill\)/);
    expect(shownFor.source).toBe("BILL_EXTRACTION");

    const fromProfile = cardById(
      report({
        facility: facility("Chhattisgarh"),
        activityData: electricityHeavyActivity([billDocument(2500, "KVA", "doc-1", "COMPLETED", null, "Unknown utility")]),
      }),
      "SOLAR_SELF_GENERATION",
    )!;
    expect(fromProfile.inputs.find((i) => i.label === "Open-access rules shown for")!.source).toBe("FACILITY_PROFILE");
  });

  it("reports no mismatch when the two agree", () => {
    const r = report();
    expect(r.billDataUsed.stateMismatch).toBeNull();
    expect(r.billDataUsed.openAccessStateSource).toBe("BILL_DISCOM");
  });

  it("falls back to the facility's state when no bill names a utility we know", () => {
    const r = report({ activityData: electricityHeavyActivity([]) });
    expect(r.billDataUsed.billState).toBeNull();
    expect(r.billDataUsed.openAccessStateSource).toBe("FACILITY_PROFILE");
    expect(r.billDataUsed.stateMismatch).toBeNull();
  });

  it("refuses to pick between two bills naming utilities in different states", () => {
    const r = report({
      activityData: electricityHeavyActivity([billDocument(2500, "KVA", "doc-1"), outOfStateBill(2500, "doc-2")]),
    });
    // Same load on both, so sizing survives; the state does not.
    expect(r.billDataUsed.billState).toBeNull();
    expect(r.billDataUsed.stateMismatch).toBeNull();
    expect(r.billDataUsed.openAccessStateSource).toBe("FACILITY_PROFILE");
  });
});

describe("high combustion share", () => {
  it("produces a directional fuel-switching note", () => {
    const r = report({ calculationResult: combustionHeavy() });
    const fuel = cardById(r, "SOLID_FUEL_SWITCHING");

    expect(fuel).toBeDefined();
    expect(r.composition!.solidFossilFuel!.sharePct).toBeGreaterThan(HIGH_SOLID_FUEL_SHARE_PCT);
    expect(fuel!.explanation).toMatch(/natural gas/i);
    expect(fuel!.explanation).toMatch(/biomass/i);
  });

  it("names no product, vendor or supplier", () => {
    const fuel = cardById(report({ calculationResult: combustionHeavy() }), "SOLID_FUEL_SWITCHING")!;
    expect(fuel.explanation).toMatch(/not a recommendation of any specific fuel supply, technology or vendor/i);
  });

  it("quotes its impact against a stated substitution share, not a hidden assumption", () => {
    const fuel = cardById(report({ calculationResult: combustionHeavy() }), "SOLID_FUEL_SWITCHING")!;
    // Coal is exactly 87.5% of the total. At 10% substituted: natural gas cuts
    // 40.7% of the substituted CO2 (8.75 x 0.40698 = 3.561), biomass all of it
    // (8.75). Impact percentages are published to one decimal place, so these
    // are asserted as the rounded figures a caller actually receives rather
    // than as an approximation of the unrounded maths.
    expect(fuel.impact!.low).toBe(3.6);
    expect(fuel.impact!.high).toBe(8.8);
    expect(fuel.impact!.basis).toMatch(/per 10% of coal\/coke energy substituted/i);
    expect(fuel.impact!.basis).toMatch(/linear/i);
  });

  it("cites IPCC for both fuel factors", () => {
    const fuel = cardById(report({ calculationResult: combustionHeavy() }), "SOLID_FUEL_SWITCHING")!;
    expect(fuel.citations.filter((c) => c.publisher === "IPCC").length).toBeGreaterThanOrEqual(2);
  });

  it("does not fire below the solid-fuel threshold", () => {
    // The electricity-heavy profile carries 1,000 tCO2e of coal in a 9,000
    // total — real coal use, but 11%, under the trigger.
    expect(cardById(report(), "SOLID_FUEL_SWITCHING")).toBeUndefined();
  });

  it("stays silent when the stored breakdown carries no readable fuel lines", () => {
    const r = report({ calculationResult: electricityHeavy({ breakdown: { notFuels: true } }) });
    expect(r.composition!.solidFossilFuel).toBeNull();
    expect(cardById(r, "SOLID_FUEL_SWITCHING")).toBeUndefined();
  });
});

describe("missing sanctioned load", () => {
  it("skips the sizing maths instead of guessing a load", () => {
    const r = report({ activityData: electricityHeavyActivity([]) });
    const solar = cardById(r, "SOLAR_SELF_GENERATION")!;

    // The recommendation still ships — the lever applies — but with no size and
    // no impact range, because both would require inventing the load.
    expect(solar.impact).toBeNull();
    expect(solar.inputs.some((i) => i.label === "Indicative system size")).toBe(false);
    expect(solar.inputs.some((i) => i.source === "BILL_EXTRACTION")).toBe(false);
    expect(solar.title).toMatch(/sizing needs a bill/i);
    expect(solar.explanation).toMatch(/no system size or impact range is shown/i);
    expect(r.billDataUsed.absenceReason).toMatch(/Upload an electricity bill/i);
  });

  it("still states the emissions position and the displacement rate", () => {
    const solar = cardById(report({ activityData: electricityHeavyActivity([]) }), "SOLAR_SELF_GENERATION")!;
    expect(solar.explanation).toMatch(new RegExp(`${NATIONAL_EF} tCO2e`));
    expect(solar.inputs.some((i) => i.source === "PLATFORM_CALCULATION")).toBe(true);
  });

  it("refuses to pick between two bills that disagree on the load", () => {
    const r = report({
      activityData: electricityHeavyActivity([billDocument(2500, "KVA", "doc-1"), billDocument(1800, "KVA", "doc-2")]),
    });
    expect(r.billDataUsed.sanctionedLoad).toBeNull();
    expect(r.billDataUsed.absenceReason).toMatch(/different sanctioned loads/i);
    expect(cardById(r, "SOLAR_SELF_GENERATION")!.impact).toBeNull();
  });

  it("ignores an extraction that never completed", () => {
    const pending = billDocument(2500, "KVA", "doc-1", "PENDING");
    const r = report({ activityData: electricityHeavyActivity([pending]) });
    expect(r.billDataUsed.sanctionedLoad).toBeNull();
    expect(cardById(r, "SOLAR_SELF_GENERATION")!.impact).toBeNull();
  });
});

describe("grid factor versus operational choice", () => {
  it("splits Scope 2 electricity into two parts that sum to the whole", () => {
    const split = buildGridFactorSplit(electricityHeavy(), { gridElectricityMwh: 10_000, renewableElectricityMwh: 0 });

    expect(split.gridFactorDrivenCo2e + split.facilityFactorChoiceCo2e).toBeCloseTo(split.scope2ElectricityCo2e, 9);
    expect(split.gridFactorDrivenSharePct + split.facilityFactorChoiceSharePct).toBeCloseTo(100, 9);
  });

  it("attributes the whole of it to the national factor when no override is used", () => {
    const split = buildGridFactorSplit(electricityHeavy(), { gridElectricityMwh: 10_000, renewableElectricityMwh: 0 });
    expect(split.gridFactorDrivenSharePct).toBeCloseTo(100, 9);
    expect(split.facilityFactorChoiceSharePct).toBeCloseTo(0, 9);
    expect(split.definitionNote).toMatch(/No facility-specific factor is in use/);
  });

  it("still sums to 100% when the facility applies a cleaner verified factor", () => {
    // A facility on a cleaner state grid overrides the national figure. The
    // second component goes negative, and the identity must still hold.
    const split = buildGridFactorSplit(electricityHeavy({ gridEmissionFactorUsed: 0.5 }), {
      gridElectricityMwh: 10_000,
      renewableElectricityMwh: 0,
    });

    expect(split.facilityFactorChoiceCo2e).toBeLessThan(0);
    expect(split.gridFactorDrivenCo2e + split.facilityFactorChoiceCo2e).toBeCloseTo(split.scope2ElectricityCo2e, 9);
    expect(split.gridFactorDrivenSharePct + split.facilityFactorChoiceSharePct).toBeCloseTo(100, 9);
    expect(split.definitionNote).toMatch(/own verified factor override/);
  });

  it("does not divide by zero for a facility drawing no grid power", () => {
    const split = buildGridFactorSplit(calcResult(), { gridElectricityMwh: 0, renewableElectricityMwh: 0 });
    expect(split.scope2ElectricityCo2e).toBe(0);
    expect(split.gridFactorDrivenSharePct).toBe(0);
    expect(split.facilityFactorChoiceSharePct).toBe(0);
    expect(Number.isNaN(split.renewableSharePct)).toBe(false);
  });

  it("reports the renewable share already in place and what it avoids", () => {
    const split = buildGridFactorSplit(electricityHeavy(), { gridElectricityMwh: 7500, renewableElectricityMwh: 2500 });
    expect(split.renewableSharePct).toBeCloseTo(25, 9);
    expect(split.alreadyAvoidedCo2e).toBeCloseTo(2500 * NATIONAL_EF, 9);
  });

  it("declines to split the product of volume and intensity, and says why", () => {
    // The tempting number — "X% of your Scope 2 is outside your control" —
    // has no non-arbitrary definition. The engine must refuse it in words
    // rather than quietly omit it.
    const card = cardById(report(), "LIABILITY_STRUCTURE")!;
    expect(card.explanation).toMatch(/no non-arbitrary way to split a product/i);
    expect(card.impact).toBeNull();
  });

  it("is always present, even for a facility with no electricity at all", () => {
    const r = report({
      calculationResult: combustionHeavy(),
      activityData: { ...electricityHeavyActivity([]), gridElectricityMwh: 0 },
    });
    expect(cardById(r, "LIABILITY_STRUCTURE")).toBeDefined();
  });
});

describe("composition", () => {
  it("shares over every component sum to 100% of the total", () => {
    const composition = buildComposition(electricityHeavy());
    const sum =
      composition.scope1Combustion.sharePct +
      composition.scope1Process.sharePct +
      composition.scope2Electricity.sharePct +
      composition.scope2Steam.sharePct +
      composition.precursorEmbedded.sharePct;
    expect(sum).toBeCloseTo(100, 9);
  });

  it("folds PFC and process N2O into the process share", () => {
    const composition = buildComposition(
      calcResult({
        directProcessCo2e: 100,
        directPfcCo2eAr5: 50,
        directN2oProcessCo2eAr5: 25,
        totalEmissionsCbamAr5: 175,
      }),
    );
    expect(composition.scope1Process.co2e).toBe(175);
    expect(composition.scope1Process.sharePct).toBeCloseTo(100, 9);
  });

  it("does not divide by zero on an all-zero calculation", () => {
    const composition = buildComposition(calcResult());
    expect(composition.scope2Electricity.sharePct).toBe(0);
    expect(composition.totalCo2e).toBe(0);
  });
});

describe("report assembly", () => {
  it("orders the structural card first, then actions by descending impact", () => {
    // A profile that trips both action rules: coal at 50% and electricity at 40%.
    const both = calcResult({
      directCombustionCo2eAr5: 5000,
      directPrecursorCo2e: 1000,
      indirectElectricityCo2e: 4000,
      totalEmissionsCbamAr5: 10_000,
      breakdown: coalFuelLine(5000),
    });
    const r = report({
      calculationResult: both,
      activityData: { ...electricityHeavyActivity(), gridElectricityMwh: 4000 / NATIONAL_EF },
    });

    expect(r.recommendations[0].id).toBe("LIABILITY_STRUCTURE");
    const rest = r.recommendations.slice(1);
    expect(rest.length).toBe(2);
    for (let i = 1; i < rest.length; i += 1) {
      expect(rest[i - 1].impact!.high).toBeGreaterThanOrEqual(rest[i].impact!.high);
    }
  });

  it("annualises grid consumption from the reporting period length", () => {
    const half = buildRecommendationReport({
      facility: facility(),
      activityData: {
        ...electricityHeavyActivity(),
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      },
      calculationResult: electricityHeavy(),
      now: new Date("2026-08-27T00:00:00.000Z"),
    });
    // 181 inclusive days of 10,000 MWh annualises to roughly 20,166 MWh.
    expect(half.activityData!.reportingPeriodDays).toBe(181);
    expect(half.activityData!.annualisedGridMwh).toBeCloseTo(10_000 * (365 / 181), 6);
  });

  it("returns an explained empty report when nothing has been submitted", () => {
    const r = buildRecommendationReport({
      facility: facility(),
      activityData: null,
      calculationResult: null,
      now: new Date("2026-08-27T00:00:00.000Z"),
    });
    expect(r.recommendations).toEqual([]);
    expect(r.composition).toBeNull();
    expect(r.unavailableReason).toMatch(/no submitted activity data/i);
  });

  it("carries the calculation timestamp it was derived from", () => {
    const r = report();
    expect(r.basedOnCalculationAt).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(r.engineVersion).toBe(RECOMMENDATION_ENGINE_VERSION);
  });

  it("is deterministic — identical inputs give byte-identical output", () => {
    const a = report();
    const b = report();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("gives every card a title, an explanation and at least one citation", () => {
    for (const card of report({ calculationResult: combustionHeavy() }).recommendations) {
      expect(card.title.length, card.id).toBeGreaterThan(0);
      expect(card.explanation.length, card.id).toBeGreaterThan(0);
      expect(card.citations.length, card.id).toBeGreaterThan(0);
      expect(typeof card.requiresComplianceReview, card.id).toBe("boolean");
    }
  });

  it("marks cards whose benchmarks are not yet compliance-reviewed", () => {
    // The solar card leans on a yield benchmark and a state tariff position,
    // neither signed off yet. Phase 3 has to be able to badge that.
    expect(cardById(report(), "SOLAR_SELF_GENERATION")!.requiresComplianceReview).toBe(true);
  });

  it("traces every quoted figure to a source", () => {
    for (const card of report({ calculationResult: combustionHeavy() }).recommendations) {
      for (const input of card.inputs) {
        expect(
          ["PLATFORM_CALCULATION", "BILL_EXTRACTION", "PUBLISHED_BENCHMARK", "FACILITY_PROFILE"],
          `${card.id} / ${input.label}`,
        ).toContain(input.source);
      }
    }
  });
});
