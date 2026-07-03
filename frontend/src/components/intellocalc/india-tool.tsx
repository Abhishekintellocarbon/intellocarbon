"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ResultsPanel, ResultLine } from "@/components/intellocalc/results-panel";
import { LeadCaptureModal } from "@/components/intellocalc/lead-capture-modal";
import { intellocalcApi } from "@/lib/api";
import { indiaFormSchema, type IndiaFormValues, type LeadContactValues } from "@/lib/validations/intellocalc";
import { INDIA_SECTOR_OPTIONS, FUEL_TYPE_MIX_OPTIONS, fmtNum } from "@/lib/intellocalc-constants";
import type { IndiaInputs, IndiaResults } from "@/lib/intellocalc-types";

const POSITION_BADGE: Record<
  IndiaResults["position"],
  { label: string; className: string; description: string }
> = {
  SURPLUS_LIKELY: {
    label: "SURPLUS LIKELY",
    className: "bg-teal-500/10 text-teal-500 border-teal-500/30",
    description: "Your intensity appears below reference. You may be eligible to earn Carbon Credit Certificates under CCTS.",
  },
  NEAR_TARGET: {
    label: "NEAR TARGET",
    className: "bg-warning/10 text-warning border-warning/30",
    description: "Your intensity is close to reference. Precise calculation needed.",
  },
  DEFICIT_LIKELY: {
    label: "DEFICIT LIKELY",
    className: "bg-danger/10 text-danger border-danger/30",
    description: "Your intensity appears above reference. You may need to purchase CCCs to comply.",
  },
  NO_REFERENCE: {
    label: "REFERENCE UNAVAILABLE",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    description: "Sector-specific target required from BEE.",
  },
};

export function IndiaTool() {
  const [pendingInputs, setPendingInputs] = useState<IndiaInputs | null>(null);
  const [results, setResults] = useState<IndiaResults | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IndiaFormValues>({ resolver: zodResolver(indiaFormSchema) });

  const onCalculate = (data: IndiaFormValues) => {
    setPendingInputs({
      sector: data.sector,
      annualProductionTonnes: Number(data.annualProductionTonnes),
      totalFuelConsumptionGj: Number(data.totalFuelConsumptionGj),
      totalElectricityMwh: Number(data.totalElectricityMwh),
      fuelTypeMix: data.fuelTypeMix,
      baselineIntensity: data.baselineIntensity ? Number(data.baselineIntensity) : undefined,
    });
  };

  const submitLead = async (contact: LeadContactValues) => {
    if (!pendingInputs) return;
    const { results } = await intellocalcApi.submitIndia(
      { ...contact, phone: contact.phone || undefined },
      pendingInputs,
    );
    setResults(results);
    setPendingInputs(null);
  };

  const badge = results ? POSITION_BADGE[results.position] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Your facility details</h2>
        <p className="mt-1 text-sm text-muted-foreground">GWP values used: AR2/BUR3 per S.O. 2825(E) 2023.</p>

        <form onSubmit={handleSubmit(onCalculate)} noValidate className="mt-5 space-y-4">
          <div>
            <Label htmlFor="sector">Sector</Label>
            <Select id="sector" {...register("sector")} error={Boolean(errors.sector)}>
              <option value="">Select sector</option>
              {INDIA_SECTOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.sector?.message} />
          </div>

          <div>
            <Label htmlFor="annualProductionTonnes">Annual production output (tonnes)</Label>
            <Input
              id="annualProductionTonnes"
              type="number"
              step="any"
              placeholder="e.g. 100000"
              {...register("annualProductionTonnes")}
              error={Boolean(errors.annualProductionTonnes)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Use equivalent product tonnes as per BEE definition for your sector.
            </p>
            <FieldError message={errors.annualProductionTonnes?.message} />
          </div>

          <div>
            <Label htmlFor="totalFuelConsumptionGj">Total annual fuel consumption (GJ)</Label>
            <Input
              id="totalFuelConsumptionGj"
              type="number"
              step="any"
              placeholder="e.g. 500000"
              {...register("totalFuelConsumptionGj")}
              error={Boolean(errors.totalFuelConsumptionGj)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sum all fuels in gigajoules. Convert: 1 tonne coal ≈ 26 GJ. 1 tonne natural gas ≈ 48 GJ.
            </p>
            <FieldError message={errors.totalFuelConsumptionGj?.message} />
          </div>

          <div>
            <Label htmlFor="totalElectricityMwh">Total annual electricity consumed (MWh)</Label>
            <Input
              id="totalElectricityMwh"
              type="number"
              step="any"
              placeholder="e.g. 12000"
              {...register("totalElectricityMwh")}
              error={Boolean(errors.totalElectricityMwh)}
            />
            <FieldError message={errors.totalElectricityMwh?.message} />
          </div>

          <div>
            <Label htmlFor="fuelTypeMix">Fuel type mix</Label>
            <Select id="fuelTypeMix" {...register("fuelTypeMix")} error={Boolean(errors.fuelTypeMix)}>
              <option value="">Select fuel type mix</option>
              {FUEL_TYPE_MIX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.fuelTypeMix?.message} />
          </div>

          <div>
            <Label htmlFor="baselineIntensity">FY2023-24 baseline GHG intensity (tCO2e/tonne)</Label>
            <Input
              id="baselineIntensity"
              type="number"
              step="any"
              placeholder="Optional"
              {...register("baselineIntensity")}
              error={Boolean(errors.baselineIntensity)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter your BEE-assigned baseline if known. Leave blank if unknown.
            </p>
            <FieldError message={errors.baselineIntensity?.message} />
          </div>

          <Button type="submit" className="w-full">
            Check My CCTS Position
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      {results && badge ? (
        <ResultsPanel>
          <h2 className="text-lg font-semibold">Your CCTS position</h2>

          <div className="mt-4">
            <ResultLine label="Your Estimated GHG Intensity" value={`${fmtNum(results.ghgIntensity, 3)} tCO2e per tonne of production`} />
            <ResultLine
              label="Sector Reference Intensity"
              value={
                results.referenceIntensity !== null
                  ? `${fmtNum(results.referenceIntensity, 3)} tCO2e per tonne`
                  : "Not available"
              }
              sub="Indicative — entity-specific targets set by BEE"
            />
          </div>

          <div className={cn("mt-4 rounded-xl border p-4", badge.className)}>
            <span className="text-xs font-bold tracking-wide">{badge.label}</span>
            <p className="mt-1 text-sm">{badge.description}</p>
          </div>

          {results.estimatedCccImpact !== null && (
            <div className="mt-4">
              <ResultLine
                label="Estimated Annual CCC Impact"
                value={
                  results.position === "SURPLUS_LIKELY"
                    ? `You may earn approximately ${fmtNum(results.estimatedCccImpact)} CCCs`
                    : `You may need approximately ${fmtNum(results.estimatedCccImpact)} CCCs`
                }
              />
            </div>
          )}

          <div className="mt-5 rounded-xl border border-surface-border bg-surface-raised p-4 text-xs text-muted-foreground">
            CCTS also reduces your CBAM exposure — if you export to EU, the carbon price you pay under CCTS can
            be deducted from your CBAM liability under Article 9 of EU 2023/956.
          </div>

          <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4 text-xs text-muted-foreground">
            This is an indicative estimate based on sector reference benchmarks. Actual CCTS targets are
            facility-specific and set by BEE. GWP values used: AR2/BUR3 as per S.O. 2825(E) 2023. CH4=21, N2O=310.
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="flex-1">
              <Button className="w-full">
                Get Your Full CCTS Compliance Report
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:abhishek@intellocarbon.com" className="flex-1">
              <Button variant="secondary" className="w-full">
                <Mail className="h-4 w-4" />
                Speak to Our Team
              </Button>
            </a>
          </div>
        </ResultsPanel>
      ) : (
        <Card className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Fill in your facility details and check to see your CCTS position here.
        </Card>
      )}

      <LeadCaptureModal
        open={Boolean(pendingInputs)}
        onClose={() => setPendingInputs(null)}
        title="See your CCTS position"
        description="Enter your details to see your results — we'll also email you a copy."
        ctaLabel="Show My Results"
        onSubmit={submitLead}
      />
    </div>
  );
}
