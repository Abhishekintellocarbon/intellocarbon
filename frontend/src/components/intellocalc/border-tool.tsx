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
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ResultsPanel, ResultLine } from "@/components/intellocalc/results-panel";
import { LeadCaptureModal } from "@/components/intellocalc/lead-capture-modal";
import { intellocalcApi } from "@/lib/api";
import { borderFormSchema, type BorderFormValues, type LeadContactValues } from "@/lib/validations/intellocalc";
import { BORDER_SECTOR_OPTIONS, BORDER_PRODUCTION_ROUTE_OPTIONS, fmtEur, fmtInr, fmtNum } from "@/lib/intellocalc-constants";
import type { BorderInputs, BorderResults } from "@/lib/intellocalc-types";

export function BorderTool() {
  const [pendingInputs, setPendingInputs] = useState<BorderInputs | null>(null);
  const [results, setResults] = useState<BorderResults | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BorderFormValues>({ resolver: zodResolver(borderFormSchema) });

  const sector = watch("sector");
  const euExportQuantityTonnes = watch("euExportQuantityTonnes");
  const showDeMinimis =
    euExportQuantityTonnes && !Number.isNaN(Number(euExportQuantityTonnes)) && Number(euExportQuantityTonnes) < 50;

  const onCalculate = (data: BorderFormValues) => {
    setPendingInputs({
      sector: data.sector,
      productionRoute: data.sector === "IRON_STEEL" ? (data.productionRoute as "EAF" | "BF_BOF") : undefined,
      annualProductionTonnes: Number(data.annualProductionTonnes),
      euExportQuantityTonnes: Number(data.euExportQuantityTonnes),
      carbonPricePaidInrPerTonne: data.carbonPricePaidInrPerTonne ? Number(data.carbonPricePaidInrPerTonne) : undefined,
    });
  };

  const submitLead = async (contact: LeadContactValues) => {
    if (!pendingInputs) return;
    const { results } = await intellocalcApi.submitBorder(
      { ...contact, phone: contact.phone || undefined },
      pendingInputs,
    );
    setResults(results);
    setPendingInputs(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Your export details</h2>
        <p className="mt-1 text-sm text-muted-foreground">All fields use EU default embedded emissions values.</p>

        <form onSubmit={handleSubmit(onCalculate)} noValidate className="mt-5 space-y-4">
          <div>
            <Label htmlFor="sector">Sector</Label>
            <Select id="sector" {...register("sector")} error={Boolean(errors.sector)}>
              <option value="">Select sector</option>
              {BORDER_SECTOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.sector?.message} />
          </div>

          {sector === "IRON_STEEL" && (
            <div>
              <Label htmlFor="productionRoute">Production route</Label>
              <Select id="productionRoute" {...register("productionRoute")} error={Boolean(errors.productionRoute)}>
                <option value="">Select production route</option>
                {BORDER_PRODUCTION_ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.productionRoute?.message} />
            </div>
          )}

          <div>
            <Label htmlFor="annualProductionTonnes">Annual total production (tonnes)</Label>
            <Input
              id="annualProductionTonnes"
              type="number"
              step="any"
              placeholder="e.g. 50000"
              {...register("annualProductionTonnes")}
              error={Boolean(errors.annualProductionTonnes)}
            />
            <FieldError message={errors.annualProductionTonnes?.message} />
          </div>

          <div>
            <Label htmlFor="euExportQuantityTonnes">Annual quantity exported to EU (tonnes)</Label>
            <Input
              id="euExportQuantityTonnes"
              type="number"
              step="any"
              placeholder="e.g. 5000"
              {...register("euExportQuantityTonnes")}
              error={Boolean(errors.euExportQuantityTonnes)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter only what goes to the EU, not your total exports. Minimum 50 tonnes for CBAM to apply.
            </p>
            <FieldError message={errors.euExportQuantityTonnes?.message} />
            {showDeMinimis && (
              <div className="mt-2">
                <Alert variant="info">
                  Your EU export quantity may be below the 50-tonne de minimis threshold. CBAM may not apply to
                  your shipments. Contact us to confirm.
                </Alert>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="carbonPricePaidInrPerTonne">Carbon price paid in India (INR per tonne)</Label>
            <Input
              id="carbonPricePaidInrPerTonne"
              type="number"
              step="any"
              placeholder="Optional"
              {...register("carbonPricePaidInrPerTonne")}
              error={Boolean(errors.carbonPricePaidInrPerTonne)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter if your facility participates in India CCTS. Leave blank if unsure.
            </p>
            <FieldError message={errors.carbonPricePaidInrPerTonne?.message} />
          </div>

          <Button type="submit" className="w-full">
            Calculate My CBAM Exposure
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      {results ? (
        <ResultsPanel>
          <h2 className="text-lg font-semibold">Your CBAM exposure estimate</h2>

          {results.deMinimisWarning && (
            <div className="mt-4">
              <Alert variant="info">
                Your EU export quantity may be below the 50-tonne de minimis threshold. CBAM may not apply to
                your shipments. Contact us to confirm.
              </Alert>
            </div>
          )}

          <div className="mt-4">
            <ResultLine
              label="EU Default Embedded Emissions Rate"
              value={`${fmtNum(results.seeValue, 3)} tCO2e per tonne`}
              sub="Source: EU 2025/2621"
            />
            <ResultLine
              label="Total Embedded Emissions for EU Exports"
              value={`${fmtNum(results.totalEmbeddedEmissionsTco2e)} tCO2e`}
            />
            <ResultLine
              label="Estimated CBAM Certificates Required"
              value={`${fmtNum(results.certificatesRequired)} certificates`}
            />
            <ResultLine
              label="Estimated CBAM Exposure"
              value={fmtEur(results.cbamLiabilityEur)}
              sub={`Approximately ${fmtInr(results.cbamLiabilityInr)}`}
            />
            {results.article9DeductionEur !== undefined && (
              <ResultLine label="Article 9 Deduction (CCTS)" value={fmtEur(results.article9DeductionEur)} />
            )}
            {results.netLiabilityEur !== undefined && (
              <ResultLine
                label="Net CBAM Exposure After CCTS Deduction"
                value={fmtEur(results.netLiabilityEur)}
              />
            )}
          </div>

          <div className="mt-5 rounded-xl border border-surface-border bg-surface-raised p-4 text-xs text-muted-foreground">
            This estimate uses EU default values per EU 2025/2621. Your actual liability depends on verified
            facility-specific embedded emissions, which are typically lower than defaults. Certificate price
            used: EUR {fmtNum(results.certificatePriceEur)} ({results.certificatePriceQuarter}).
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="flex-1">
              <Button className="w-full">
                Generate Your Verified CBAM Report
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
          Fill in your export details and calculate to see your CBAM exposure estimate here.
        </Card>
      )}

      <LeadCaptureModal
        open={Boolean(pendingInputs)}
        onClose={() => setPendingInputs(null)}
        title="See your CBAM exposure estimate"
        description="Enter your details to see your results — we'll also email you a copy."
        ctaLabel="Show My Results"
        onSubmit={submitLead}
      />
    </div>
  );
}
