import { describe, it, expect } from "vitest";
import { buildPathwayReport, parseProductionChangePct, PATHWAY_ENGINE_VERSION } from "../index";
import { METRIC_DECIMALS, observedProductionGrowthPct } from "../scenarios";
import { buildRecommendationReport } from "../../recommendationEngine";
import { getCbamCertificatePrice } from "../../../data/cbamReferenceData";
import { getGridEmissionFactor } from "../../../data/emissionFactors";
import {
  SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR,
  SOLAR_OFFSET_DESIGN_RANGE,
} from "../../../data/decarbonizationBenchmarks";
import type { PathwayMetric, PathwayReport, PathwayScenarioId } from "../types";

/**
 * Pathway Modelling projects stored data forward; it calculates nothing new. So
 * these tests hand it fabricated calculation rows and pin the output exactly —
 * no database, no server.
 *
 * The expected figures below are written out longhand from the published inputs
 * rather than obtained by calling the code under test. That is the point: a
 * test that recomputed the projection with the same helper would pass whatever
 * the helper did. Where a value is maintained elsewhere and can legitimately
 * change (the grid factor, the certificate price), it is read from its source
 * and carried through the longhand arithmetic, so a factor update moves the
 * expectation with the product instead of breaking the test spuriously.
 *
 * As with the recommendation engine, much of what is under test is restraint:
 * several cases assert a null and a stated reason rather than a number.
 */

const EF = getGridEmissionFactor();
const PRICE = getCbamCertificatePrice().pricePerTonneEur;

// --- The known test facility ------------------------------------------------
// Round numbers throughout so the manual arithmetic below is checkable by eye.
//
//   production                10,000 t
//   CBAM (AR5) total          20,000 tCO2e   -> SEE 2.0 tCO2e/t
//   CCTS (AR2-BUR3) total     19,800 tCO2e   -> GEI 1.98 tCO2e/t
//   notified CCTS target      2.00 tCO2e/t   -> surplus of 200 tCO2e
//   grid drawn                8,000 MWh over a full 365-day year (28.6% of total,
//                             clearing the 20% share at which solar is recommended)
const PRODUCTION = 10_000;
const TOTAL_CBAM = 20_000;
const TOTAL_CCTS = 19_800;
const INTENSITY_CCTS = TOTAL_CCTS / PRODUCTION; // 1.98
const TARGET = 2.0;
const GRID_MWH = 8_000;

/** 2025-04-01 to 2026-03-31 inclusive is 365 days, so annualised == period. */
const PERIOD = {
  periodStart: new Date("2025-04-01T00:00:00.000Z"),
  periodEnd: new Date("2026-03-31T00:00:00.000Z"),
};

const facility = { id: "fac-1", name: "Plant A", state: "Chhattisgarh", sector: "STEEL" };

const billDocument = (value: number, unit = "KVA") => ({
  id: "doc-1",
  billExtraction: {
    status: "COMPLETED",
    state: "Chhattisgarh",
    sanctionedLoadValue: value,
    sanctionedLoadUnit: unit,
    discomName: "Chhattisgarh State Power Distribution Co. Ltd. (CSPDCL)",
    tariffCode: "HT-I",
  },
});

type PeriodOver = Partial<{
  productionQuantityT: number | null;
  electricityExportedEuMwh: number | null;
  sector: string;
  cctsTargetIntensity: number | null;
  carbonPricePaidEurPerTonne: number | null;
  gridElectricityMwh: number;
  documents: ReturnType<typeof billDocument>[];
  totalEmissionsCbamAr5: number;
  totalEmissionsCctsAr2Bur3: number;
  ghgIntensityCcts: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  calculationResult: null;
}>;

const period = (over: PeriodOver = {}) => {
  const totalCbam = over.totalEmissionsCbamAr5 ?? TOTAL_CBAM;
  const totalCcts = over.totalEmissionsCctsAr2Bur3 ?? TOTAL_CCTS;
  const production = over.productionQuantityT === undefined ? PRODUCTION : over.productionQuantityT;
  return {
    id: "ad-1",
    sector: over.sector ?? "STEEL",
    periodStart: over.periodStart === undefined ? PERIOD.periodStart : over.periodStart,
    periodEnd: over.periodEnd === undefined ? PERIOD.periodEnd : over.periodEnd,
    productionQuantityT: production,
    electricityExportedEuMwh: over.electricityExportedEuMwh ?? null,
    carbonPricePaidEurPerTonne: over.carbonPricePaidEurPerTonne ?? null,
    cctsTargetIntensity: over.cctsTargetIntensity === undefined ? TARGET : over.cctsTargetIntensity,
    gridElectricityMwh: over.gridElectricityMwh ?? GRID_MWH,
    documents: over.documents ?? [billDocument(100_000)],
    calculationResult:
      over.calculationResult === null
        ? null
        : {
            totalEmissionsCbamAr5: totalCbam,
            totalEmissionsCctsAr2Bur3: totalCcts,
            indirectElectricityCo2e: (over.gridElectricityMwh ?? GRID_MWH) * EF,
            ghgIntensityCcts: over.ghgIntensityCcts ?? (production ? totalCcts / production : 0),
            gridEmissionFactorUsed: EF,
            calculatedAt: new Date("2026-07-01T00:00:00.000Z"),
          },
  };
};

const historyEntry = (production: number | null, periodEnd: string) => ({
  periodEnd: new Date(periodEnd),
  sector: "STEEL",
  productionQuantityT: production,
  electricityExportedEuMwh: null,
});

const report = (over: {
  period?: ReturnType<typeof period> | null;
  history?: ReturnType<typeof historyEntry>[];
  productionChangePct?: number | null;
} = {}): PathwayReport =>
  buildPathwayReport({
    facility,
    period: over.period === undefined ? period() : over.period,
    history: over.history ?? [historyEntry(PRODUCTION, "2026-03-31")],
    productionChangePct: over.productionChangePct ?? null,
    now: new Date("2026-09-05T00:00:00.000Z"),
  });

const scenario = (r: PathwayReport, id: PathwayScenarioId) => r.scenarios.find((s) => s.id === id)!;
const metric = (r: PathwayReport, id: PathwayScenarioId, m: PathwayMetric["metric"]) =>
  scenario(r, id).metrics.find((x) => x.metric === m)!;

/** Longhand solar sizing from the two published ranges, written out here rather than imported. */
const manualSolar = (annualMwh: number, capKw: number) => {
  const yLow = SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.low;
  const yHigh = SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.high;
  const kwpLow = Math.min((annualMwh * 1000 * SOLAR_OFFSET_DESIGN_RANGE.low) / yHigh, capKw);
  const kwpHigh = Math.min((annualMwh * 1000 * SOLAR_OFFSET_DESIGN_RANGE.high) / yLow, capKw);
  return {
    savedLow: Math.min((kwpLow * yLow) / 1000, annualMwh) * EF,
    savedHigh: Math.min((kwpHigh * yHigh) / 1000, annualMwh) * EF,
  };
};

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

describe("pathway modelling — the current position it projects from", () => {
  it("reads the current position from the stored calculation, not from a recomputation", () => {
    const r = report();
    expect(r.current).not.toBeNull();
    expect(r.current!.totalEmissionsCbamAr5).toBe(TOTAL_CBAM);
    expect(r.current!.ghgIntensityCcts).toBe(INTENSITY_CCTS);
    // (2.00 - 1.98) x 10,000 = 200 tCO2e of surplus.
    expect(r.current!.cctsPositionTco2e).toBeCloseTo(200, 6);
    expect(r.current!.cbamNetLiabilityEur).toBeCloseTo(TOTAL_CBAM * PRICE, 6);
    expect(r.engineVersion).toBe(PATHWAY_ENGINE_VERSION);
  });

  it("returns no position and a stated reason when there is no calculated period", () => {
    const r = report({ period: null });
    expect(r.current).toBeNull();
    expect(r.scenarios).toEqual([]);
    expect(r.unavailableReason).toContain("no submitted activity data");
  });

  it("prices electricity-sector production off EU-exported MWh, as the CBAM report does", () => {
    const r = report({
      period: period({ sector: "ELECTRICITY", productionQuantityT: 999, electricityExportedEuMwh: 4_000 }),
    });
    expect(r.current!.productionQuantityT).toBe(4_000);
    expect(r.current!.productionBasisLabel).toBe("MWh exported to the EU");
  });
});

describe("pathway modelling — adopt the recommended solar capacity", () => {
  it("projects emissions using the same capacity the recommendation card sizes", () => {
    const r = report();
    const m = metric(r, "SOLAR_RECOMMENDED_CAPACITY", "TOTAL_EMISSIONS_TCO2E");
    const { savedLow, savedHigh } = manualSolar(GRID_MWH, 100_000);

    expect(m.current).toBe(TOTAL_CBAM);
    expect(m.projected!.low).toBe(round(TOTAL_CBAM - savedHigh, 1));
    expect(m.projected!.high).toBe(round(TOTAL_CBAM - savedLow, 1));
    expect(m.projected!.isPoint).toBe(false);
    expect(m.lowerIsBetter).toBe(true);
  });

  it("sizes the identical system the recommendation engine does, to the tonne", () => {
    // The guarantee that matters commercially: the pathway cannot project a
    // different system from the one the card beside it recommends.
    const rec = buildRecommendationReport({
      facility,
      activityData: {
        id: "ad-1",
        ...PERIOD,
        gridElectricityMwh: GRID_MWH,
        renewableElectricityMwh: 0,
        documents: [billDocument(100_000)],
      },
      calculationResult: {
        totalEmissionsCbamAr5: TOTAL_CBAM,
        directCombustionCo2eAr5: 0,
        directProcessCo2e: 0,
        directPfcCo2eAr5: 0,
        directN2oProcessCo2eAr5: 0,
        directPrecursorCo2e: 0,
        indirectElectricityCo2e: GRID_MWH * EF,
        indirectSteamCo2e: 0,
        gridEmissionFactorUsed: EF,
        breakdown: { fuels: [] },
        calculatedAt: new Date("2026-07-01T00:00:00.000Z"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const card = rec.recommendations.find((c) => c.id === "SOLAR_SELF_GENERATION")!;
    const sizeInput = card.inputs.find((i) => i.label === "Indicative system size")!.value;

    const pathwayCapacity = metric(r0(), "SOLAR_RECOMMENDED_CAPACITY", "TOTAL_EMISSIONS_TCO2E").inputs.find(
      (i) => i.label === "Capacity modelled",
    )!;
    expect(pathwayCapacity.value).toBe(`${sizeInput.replace(" kWp", "")} kWp`);
  });

  it("moves the CCTS position by exactly the tonnes displaced, at unchanged production", () => {
    const r = report();
    const m = metric(r, "SOLAR_RECOMMENDED_CAPACITY", "CCTS_POSITION_TCO2E");
    const { savedLow, savedHigh } = manualSolar(GRID_MWH, 100_000);

    // Production is held, so the surplus grows tonne for tonne with the saving:
    // 200 + savedLow at the conservative end, 200 + savedHigh at the optimistic.
    expect(m.projected!.low).toBe(round(200 + savedLow, 1));
    expect(m.projected!.high).toBe(round(200 + savedHigh, 1));
    // A surplus wants to rise — the UI cannot infer the tone from the sign.
    expect(m.lowerIsBetter).toBe(false);
  });

  it("prices the projected tonnage through the same certificate arithmetic as the report", () => {
    const r = report();
    const m = metric(r, "SOLAR_RECOMMENDED_CAPACITY", "CBAM_LIABILITY_EUR");
    const { savedLow, savedHigh } = manualSolar(GRID_MWH, 100_000);

    expect(m.projected!.low).toBe(round((TOTAL_CBAM - savedHigh) * PRICE, 0));
    expect(m.projected!.high).toBe(round((TOTAL_CBAM - savedLow) * PRICE, 0));
    expect(m.current).toBe(round(TOTAL_CBAM * PRICE, 0));
  });

  it("scales an annual sizing down to a quarterly reporting period rather than overstating it fourfold", () => {
    // 92 days: 01 Jan to 02 Apr 2026 inclusive.
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-04-02T00:00:00.000Z");
    const quarterMwh = 2_000; // annualises to ~7,935 MWh
    const quarterTotal = 5_000; // a quarter's emissions, so the shares stay comparable
    const r = report({
      period: period({
        periodStart: start,
        periodEnd: end,
        gridElectricityMwh: quarterMwh,
        totalEmissionsCbamAr5: quarterTotal,
        totalEmissionsCctsAr2Bur3: 4_950,
      }),
    });

    const days = 92;
    const annualised = quarterMwh * (365 / days);
    const { savedLow, savedHigh } = manualSolar(annualised, 100_000);
    const share = days / 365;

    const m = metric(r, "SOLAR_RECOMMENDED_CAPACITY", "TOTAL_EMISSIONS_TCO2E");
    expect(m.projected!.low).toBe(round(quarterTotal - savedHigh * share, 1));
    expect(m.projected!.high).toBe(round(quarterTotal - savedLow * share, 1));
    // Sanity: a quarter's saving must be far below the annual one.
    expect(quarterTotal - m.projected!.high).toBeLessThan(savedLow);
  });

  it("respects the sanctioned-load cap read off the bill", () => {
    // 8,000 MWh/year sizes to 750–1,714 kWp before the cap, so a 900 kVA
    // sanctioned load binds the top of the range and leaves the bottom alone.
    const capped = report({ period: period({ documents: [billDocument(900)] }) });
    const uncapped = report();
    const c = metric(capped, "SOLAR_RECOMMENDED_CAPACITY", "TOTAL_EMISSIONS_TCO2E");
    const u = metric(uncapped, "SOLAR_RECOMMENDED_CAPACITY", "TOTAL_EMISSIONS_TCO2E");
    // A smaller permitted system removes less, so the projected total is higher.
    expect(c.projected!.low).toBeGreaterThan(u.projected!.low);
    expect(c.inputs.find((i) => i.label === "Capacity modelled")!.value).toBe("750–900 kWp");
    // The bottom of the range is unaffected by a cap that only binds the top.
    expect(c.projected!.high).toBe(u.projected!.high);
  });

  it("projects nothing, with the engine's own reason, when no sanctioned load is available", () => {
    const r = report({ period: period({ documents: [] }) });
    const s = scenario(r, "SOLAR_RECOMMENDED_CAPACITY");
    expect(s.metrics).toEqual([]);
    expect(s.unavailableReason).toContain("Upload an electricity bill");
  });

  it("projects nothing when two bills disagree on the sanctioned load, rather than picking one", () => {
    const r = report({
      period: period({ documents: [billDocument(2_500), { ...billDocument(4_000), id: "doc-2" }] }),
    });
    const s = scenario(r, "SOLAR_RECOMMENDED_CAPACITY");
    expect(s.metrics).toEqual([]);
    expect(s.unavailableReason).toContain("different sanctioned loads");
  });
});

describe("pathway modelling — production change", () => {
  it("scales emissions, liability and the CCTS position in exact proportion to volume", () => {
    const r = report({ productionChangePct: 10 });

    // +10% at held intensity: 22,000 tCO2e, 220 tCO2e of surplus.
    expect(metric(r, "PRODUCTION_CHANGE", "TOTAL_EMISSIONS_TCO2E").projected!.low).toBe(22_000);
    expect(metric(r, "PRODUCTION_CHANGE", "CCTS_POSITION_TCO2E").projected!.low).toBe(220);
    expect(metric(r, "PRODUCTION_CHANGE", "CBAM_LIABILITY_EUR").projected!.low).toBe(round(22_000 * PRICE, 0));
  });

  it("handles a decrease the same way, and never claims intensity improved", () => {
    const r = report({ productionChangePct: -20 });
    expect(metric(r, "PRODUCTION_CHANGE", "TOTAL_EMISSIONS_TCO2E").projected!.low).toBe(16_000);
    expect(metric(r, "PRODUCTION_CHANGE", "CCTS_POSITION_TCO2E").projected!.low).toBe(160);
    expect(
      metric(r, "PRODUCTION_CHANGE", "CCTS_POSITION_TCO2E").caveats.some((c) =>
        c.includes("never brings a facility over its notified target"),
      ),
    ).toBe(true);
  });

  it("shows one figure, not a range, because the arithmetic is exact given the stated assumption", () => {
    const r = report({ productionChangePct: 10 });
    for (const m of scenario(r, "PRODUCTION_CHANGE").metrics) {
      expect(m.projected!.isPoint).toBe(true);
      expect(m.projected!.low).toBe(m.projected!.high);
    }
    expect(scenario(r, "PRODUCTION_CHANGE").assumption).toContain("holding emissions intensity");
  });

  it("states the held-intensity assumption instead of inventing a fixed-versus-variable split", () => {
    const r = report({ productionChangePct: 10 });
    const caveat = metric(r, "PRODUCTION_CHANGE", "TOTAL_EMISSIONS_TCO2E").caveats[0];
    expect(caveat).toContain("does not hold a fixed-versus-variable split");
  });

  it("moves the Article 9 deduction with volume rather than holding it fixed", () => {
    // 10 EUR/tCO2e paid at origin on 10,000 t of production deducts
    // (10 x 10,000) / price tonnes today, and 10% more at +10% production.
    const r = report({
      period: period({ carbonPricePaidEurPerTonne: 10 }),
      productionChangePct: 10,
    });
    const deductedNow = (10 * PRODUCTION) / PRICE;
    const deductedThen = (10 * PRODUCTION * 1.1) / PRICE;
    const m = metric(r, "PRODUCTION_CHANGE", "CBAM_LIABILITY_EUR");

    expect(m.current).toBe(round((TOTAL_CBAM - deductedNow) * PRICE, 0));
    expect(m.projected!.low).toBe(round((TOTAL_CBAM * 1.1 - deductedThen) * PRICE, 0));
    expect(m.caveats.some((c) => c.includes("Article 9"))).toBe(true);
  });

  it("projects nothing until a change is entered — no default percentage", () => {
    const s = scenario(report(), "PRODUCTION_CHANGE");
    expect(s.metrics).toEqual([]);
    expect(s.unavailableReason).toContain("nothing is assumed on your behalf");
  });

  it("rejects a change outside the modelled bounds, and rounds to one decimal place", () => {
    expect(parseProductionChangePct("12.34")).toBe(12.3);
    expect(parseProductionChangePct(undefined)).toBeNull();
    expect(parseProductionChangePct("")).toBeNull();
    expect(() => parseProductionChangePct("abc")).toThrow(/must be a number/);
    expect(() => parseProductionChangePct(-100)).toThrow(/between/);
    expect(() => parseProductionChangePct(500)).toThrow(/between/);
  });
});

describe("pathway modelling — business as usual", () => {
  it("carries the facility's own observed trend forward, not an assumed growth rate", () => {
    // 8,000 t then 10,000 t is a single observed +25% move.
    const r = report({
      history: [historyEntry(8_000, "2025-03-31"), historyEntry(10_000, "2026-03-31")],
    });
    const m = metric(r, "BUSINESS_AS_USUAL", "TOTAL_EMISSIONS_TCO2E");
    expect(m.projected!.low).toBe(25_000);
    expect(m.projected!.isPoint).toBe(true);
    expect(m.projected!.basis).toContain("One observation is not a trend");
  });

  it("spans the slowest and fastest changes actually observed once there are several", () => {
    const r = report({
      history: [historyEntry(8_000, "2024-03-31"), historyEntry(10_000, "2025-03-31"), historyEntry(10_500, "2026-03-31")],
    });
    // Observed: +25% and +5%.
    const m = metric(r, "BUSINESS_AS_USUAL", "TOTAL_EMISSIONS_TCO2E");
    expect(m.projected!.low).toBe(21_000);
    expect(m.projected!.high).toBe(25_000);
    expect(m.projected!.isPoint).toBe(false);
    expect(m.projected!.basis).toContain("not a confidence interval");
  });

  it("projects nothing on a single reporting period rather than assuming a growth rate", () => {
    const s = scenario(report({ history: [historyEntry(PRODUCTION, "2026-03-31")] }), "BUSINESS_AS_USUAL");
    expect(s.metrics).toEqual([]);
    expect(s.unavailableReason).toContain("cannot be drawn through a single point");
  });

  it("skips a pair whose earlier period recorded no production, rather than dividing by zero", () => {
    expect(observedProductionGrowthPct([{ periodEnd: null, production: 0 }, { periodEnd: null, production: 100 }])).toEqual(
      [],
    );
    expect(
      observedProductionGrowthPct([{ periodEnd: null, production: null }, { periodEnd: null, production: 100 }]),
    ).toEqual([]);
    expect(observedProductionGrowthPct([{ periodEnd: null, production: 100 }, { periodEnd: null, production: 150 }])).toEqual(
      [50],
    );
  });

  it("runs the same volume kernel as an equivalent stated production change", () => {
    const bau = report({ history: [historyEntry(8_000, "2025-03-31"), historyEntry(10_000, "2026-03-31")] });
    const stated = report({ productionChangePct: 25 });
    for (const m of ["TOTAL_EMISSIONS_TCO2E", "CBAM_LIABILITY_EUR", "CCTS_POSITION_TCO2E"] as const) {
      expect(metric(bau, "BUSINESS_AS_USUAL", m).projected!.low).toBe(metric(stated, "PRODUCTION_CHANGE", m).projected!.low);
    }
  });
});

describe("pathway modelling — precision and provenance discipline", () => {
  const everyMetric = (r: PathwayReport) => r.scenarios.flatMap((s) => s.metrics);

  const allReports = () => [
    report({ productionChangePct: 10 }),
    report({ productionChangePct: -33.3, history: [historyEntry(8_000, "2025-03-31"), historyEntry(10_000, "2026-03-31")] }),
    report({ period: period({ carbonPricePaidEurPerTonne: 12.5 }), productionChangePct: 7.5 }),
  ];

  it("never emits a figure to more precision than its metric supports", () => {
    for (const r of allReports()) {
      for (const m of everyMetric(r)) {
        if (!m.projected) continue;
        const dp = METRIC_DECIMALS[m.metric];
        expect(m.projected.decimals).toBe(dp);
        expect(m.projected.low).toBe(round(m.projected.low, dp));
        expect(m.projected.high).toBe(round(m.projected.high, dp));
        expect(m.changeLow).toBe(round(m.changeLow!, dp));
        expect(m.changeHigh).toBe(round(m.changeHigh!, dp));
      }
    }
  });

  it("prices liability in whole euros — a projected tonnage does not support cents", () => {
    expect(METRIC_DECIMALS.CBAM_LIABILITY_EUR).toBe(0);
    for (const r of allReports()) {
      for (const m of everyMetric(r).filter((x) => x.metric === "CBAM_LIABILITY_EUR" && x.projected)) {
        expect(Number.isInteger(m.projected!.low)).toBe(true);
        expect(Number.isInteger(m.projected!.high)).toBe(true);
      }
    }
  });

  it("gives every projected figure a low, a high and words saying what the two ends are", () => {
    for (const r of allReports()) {
      for (const m of everyMetric(r)) {
        if (!m.projected) continue;
        expect(m.projected.low).toBeLessThanOrEqual(m.projected.high);
        expect(m.projected.basis.length).toBeGreaterThan(40);
      }
    }
  });

  it("labels every projected metric with what it was projected from", () => {
    for (const r of allReports()) {
      for (const m of everyMetric(r)) {
        if (!m.projected) continue;
        expect(m.projectedFrom.length).toBeGreaterThan(0);
      }
    }
  });

  it("badges projected inputs as PROJECTED and says what each derives from", () => {
    for (const r of allReports()) {
      for (const m of everyMetric(r)) {
        for (const input of m.inputs.filter((i) => i.source === "PROJECTED")) {
          expect(input.derivedFrom).toBeTruthy();
        }
      }
      // A projection with no projected input at all would mean the workings
      // show only measured facts, hiding where the forward step happened.
      const projectedInputs = everyMetric(r).flatMap((m) => m.inputs.filter((i) => i.source === "PROJECTED"));
      expect(projectedInputs.length).toBeGreaterThan(0);
    }
  });

  it("never marks the current position as projected", () => {
    for (const r of allReports()) {
      for (const m of everyMetric(r)) {
        expect(m.currentSource).not.toBe("PROJECTED");
      }
    }
  });

  it("never lets the recommendation engine emit a PROJECTED badge", () => {
    const rec = buildRecommendationReport({
      facility,
      activityData: {
        id: "ad-1",
        ...PERIOD,
        gridElectricityMwh: GRID_MWH,
        renewableElectricityMwh: 0,
        documents: [billDocument(100_000)],
      },
      calculationResult: {
        totalEmissionsCbamAr5: TOTAL_CBAM,
        directCombustionCo2eAr5: 0,
        directProcessCo2e: 0,
        directPfcCo2eAr5: 0,
        directN2oProcessCo2eAr5: 0,
        directPrecursorCo2e: 0,
        indirectElectricityCo2e: GRID_MWH * EF,
        indirectSteamCo2e: 0,
        gridEmissionFactorUsed: EF,
        breakdown: { fuels: [] },
        calculatedAt: new Date("2026-07-01T00:00:00.000Z"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const sources = rec.recommendations.flatMap((c) => c.inputs.map((i) => i.source));
    expect(sources).not.toContain("PROJECTED");
  });

  it("is deterministic — the same inputs give byte-identical output", () => {
    const a = report({ productionChangePct: 10 });
    const b = report({ productionChangePct: 10 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("pathway modelling — refusals", () => {
  it("states the CCTS position as unavailable, and projects none, without a notified target", () => {
    const r = report({ period: period({ cctsTargetIntensity: null }), productionChangePct: 10 });
    expect(r.current!.cctsPositionTco2e).toBeNull();
    for (const id of ["SOLAR_RECOMMENDED_CAPACITY", "PRODUCTION_CHANGE"] as const) {
      const m = metric(r, id, "CCTS_POSITION_TCO2E");
      expect(m.projected).toBeNull();
      expect(m.current).toBeNull();
      expect(m.unavailableReason).toContain("No BEE-notified GHG emission intensity target");
    }
  });

  it("refuses every volume scenario when the period records no production quantity", () => {
    const r = report({ period: period({ productionQuantityT: null }), productionChangePct: 10 });
    expect(scenario(r, "PRODUCTION_CHANGE").metrics).toEqual([]);
    expect(scenario(r, "PRODUCTION_CHANGE").unavailableReason).toContain("no production quantity");
    expect(scenario(r, "BUSINESS_AS_USUAL").metrics).toEqual([]);
  });

  it("still offers a scenario it cannot run, with the reason, rather than hiding the option", () => {
    const r = report({ period: period({ documents: [] }) });
    expect(r.scenarios.map((s) => s.id)).toEqual([
      "BUSINESS_AS_USUAL",
      "SOLAR_RECOMMENDED_CAPACITY",
      "PRODUCTION_CHANGE",
    ]);
    for (const s of r.scenarios) {
      if (s.metrics.length === 0) expect(s.unavailableReason).toBeTruthy();
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.assumption.length).toBeGreaterThan(0);
    }
  });
});

/** The default report, used where a nested call would shadow `report`. */
const r0 = () => report();
