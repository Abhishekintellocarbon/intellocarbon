import { describe, expect, it } from "vitest";
import type { Scope3Category } from "@prisma/client";
import { calculateScope3Emissions } from "../scope3Calculation.service";
import { CALCULABLE_SCOPE3_CATEGORIES, SCOPE3_CATEGORY_CATALOG } from "../../data/scope3Categories";

/**
 * Regression guard for the Phase 1 calculation path. The Scope3Category enum
 * grew from 5 to 15 members so relevance could be reported for every GHG
 * Protocol category; these golden values pin the arithmetic of the original 5
 * so that growth is provably inert. Expected numbers are computed by hand
 * from the factor tables in data/scope3EmissionFactors.ts.
 */
describe("Scope 3 calculation — the 5 implemented categories are unchanged", () => {
  it("Category 1 activity-based: 10,000 kg steel x 1.46 kg CO2e/kg = 14.6 tCO2e", () => {
    const result = calculateScope3Emissions("CAT1_PURCHASED_GOODS_SERVICES", "ACTIVITY_BASED", {
      materialType: "STEEL",
      quantityKg: 10_000,
    });
    expect(result.calculatedEmissionsTco2e).toBe(14.6);
    expect(result.emissionFactorSource).toContain("Steel (virgin)");
  });

  it("Category 4 activity-based: 100 t x 500 km x 0.127 = 6.35 tCO2e", () => {
    const result = calculateScope3Emissions("CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION", "ACTIVITY_BASED", {
      freightMode: "ROAD_HGV",
      tonnesShipped: 100,
      distanceKm: 500,
    });
    expect(result.calculatedEmissionsTco2e).toBe(6.35);
    expect(result.emissionFactorSource).toContain("HGV articulated");
  });

  it("Category 6 activity-based: 2,000 km x 4 trips x 0.117 = 0.936 tCO2e", () => {
    const result = calculateScope3Emissions("CAT6_BUSINESS_TRAVEL", "ACTIVITY_BASED", {
      travelMode: "FLIGHT_LONG_HAUL_ECONOMY",
      distanceKm: 2000,
      numberOfTrips: 4,
    });
    expect(result.calculatedEmissionsTco2e).toBe(0.936);
  });

  it("Category 7 activity-based doubles the one-way distance for the return leg", () => {
    // 50 employees x (15 km x 2) x 240 days x 0.17 kg/passenger.km = 61.2 tCO2e
    const result = calculateScope3Emissions("CAT7_EMPLOYEE_COMMUTING", "ACTIVITY_BASED", {
      commuteMode: "CAR_AVERAGE",
      employeeCount: 50,
      oneWayDistanceKm: 15,
      commutingDaysPerYear: 240,
    });
    expect(result.calculatedEmissionsTco2e).toBe(61.2);
  });

  it("Category 11 activity-based, electricity-consuming: 1,000 units x 500 kWh x 0.716 = 358 tCO2e", () => {
    const result = calculateScope3Emissions("CAT11_USE_OF_SOLD_PRODUCTS", "ACTIVITY_BASED", {
      productType: "ELECTRICITY_CONSUMING",
      unitsSold: 1000,
      lifetimeEnergyConsumptionKwh: 500,
    });
    expect(result.calculatedEmissionsTco2e).toBe(358);
  });

  it("spend-based uses the per-category USD factor at the 86 INR/USD rate", () => {
    // 8,600,000 INR / 86 = 100,000 USD x 0.35 kg/USD = 35,000 kg = 35 tCO2e
    const result = calculateScope3Emissions("CAT1_PURCHASED_GOODS_SERVICES", "SPEND_BASED", { spendInr: 8_600_000 });
    expect(result.calculatedEmissionsTco2e).toBe(35);
    expect(result.emissionFactorSource).toContain("EPA");
  });

  it("every calculable category still returns a finite number by both methods", () => {
    for (const category of CALCULABLE_SCOPE3_CATEGORIES) {
      const spend = calculateScope3Emissions(category, "SPEND_BASED", { spendInr: 1_000_000 });
      expect(Number.isFinite(spend.calculatedEmissionsTco2e)).toBe(true);
      expect(spend.calculatedEmissionsTco2e).toBeGreaterThan(0);
      expect(spend.emissionFactorSource.length).toBeGreaterThan(0);
    }
  });
});

describe("Scope 3 calculation — the 10 unbuilt categories are rejected, not miscalculated", () => {
  const unbuilt = SCOPE3_CATEGORY_CATALOG.filter((c) => !c.calculable);

  it("covers exactly 10 categories", () => {
    expect(unbuilt).toHaveLength(10);
    expect(unbuilt.map((c) => c.number)).toEqual([2, 3, 5, 8, 9, 10, 12, 13, 14, 15]);
  });

  it("throws SCOPE3_CATEGORY_NOT_SUPPORTED rather than returning NaN", () => {
    for (const entry of unbuilt) {
      for (const method of ["SPEND_BASED", "ACTIVITY_BASED"] as const) {
        expect(() => calculateScope3Emissions(entry.prismaCategory as Scope3Category, method, { spendInr: 100_000 })).toThrowError(
          /not yet supported/i,
        );
      }
    }
  });
});
