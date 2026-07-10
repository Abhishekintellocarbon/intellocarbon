import type { CompanyBrsrAnalytics } from "@/lib/types";
import { WaterTrendChart } from "./water-trend-chart";
import { EnergyCompositionChart } from "./energy-composition-chart";
import { WasteTrendChart } from "./waste-trend-chart";
import { GenderDiversityChart } from "./gender-diversity-chart";
import { SafetyIncidentCard } from "./safety-incident-card";
import { BrsrFacilityComparisonChart } from "./facility-comparison-chart";

/**
 * ESG / BRSR Core charts — a distinct sub-section within the same Analytics
 * area as the CBAM/CCTS charts (analytics-section.tsx), rather than mixed
 * into that grid, since it's a different compliance framework with its own
 * heading. The caller only renders this once analytics.brsr is non-null
 * and has at least one submitted report — see AnalyticsSection.
 */
export function EsgBrsrSection({ brsr }: { brsr: CompanyBrsrAnalytics }) {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold">ESG / BRSR Core</h2>
      <p className="mt-1 text-sm text-muted-foreground">Water, waste, energy, and workforce trends across all your facilities.</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <WaterTrendChart data={brsr.waterTrend} />
        <WasteTrendChart data={brsr.wasteTrend} />
        <EnergyCompositionChart energy={brsr.energyComposition} />
        <GenderDiversityChart gender={brsr.genderDiversity} />
        <div className="sm:col-span-2">
          <SafetyIncidentCard safety={brsr.safetyIncidentRate} />
        </div>
        {brsr.facilityComparison.length >= 2 && (
          <div className="sm:col-span-2">
            <BrsrFacilityComparisonChart data={brsr.facilityComparison} />
          </div>
        )}
      </div>
    </div>
  );
}
