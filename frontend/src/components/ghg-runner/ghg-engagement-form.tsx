"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ghgRunnerApi, referenceApi, ApiError } from "@/lib/api";
import type {
  GhgEngagement,
  GhgEngagementInput,
  GhgJurisdictionConfig,
  GhgJurisdictionKey,
  GhgScope1Entry,
  GhgScope2Entry,
  GhgCalculationResult,
  FuelDefinition,
} from "@/lib/types";
import { GhgBreakdownView } from "./ghg-breakdown-view";

const newId = () => Math.random().toString(36).slice(2, 10);

// Pre-filled, editable — the admin can always overwrite it, but a source
// still has to be present on every save (validated server-side too).
const LIBRARY_DEFAULT_SOURCE = "IPCC 2006 Guidelines for National GHG Inventories, Volume 2 (Energy)";

const emptyScope1Entry = (fuels: FuelDefinition[]): GhgScope1Entry => {
  const first = fuels[0];
  return {
    id: newId(),
    sourceType: first?.key ?? "CUSTOM",
    label: first?.label ?? "Custom source",
    quantity: 0,
    unit: first?.unit ?? "",
    isCustom: !first,
    source: first ? LIBRARY_DEFAULT_SOURCE : "",
  };
};

const emptyScope2Entry = (): GhgScope2Entry => ({
  id: newId(),
  label: "",
  quantityValue: 0,
  quantityUnit: "kWh",
  gridFactorValue: 0,
  source: "",
});

const toDateInputValue = (iso: string) => iso.slice(0, 10);

export function GhgEngagementForm({
  existingEngagement,
  initialCalculation,
  onSaved,
}: {
  existingEngagement?: GhgEngagement;
  initialCalculation?: GhgCalculationResult;
  onSaved: (engagement: GhgEngagement, calculation: GhgCalculationResult) => void;
}) {
  const [jurisdictions, setJurisdictions] = useState<GhgJurisdictionConfig[] | null>(null);
  const [fuels, setFuels] = useState<FuelDefinition[] | null>(null);

  const [organizationName, setOrganizationName] = useState(existingEngagement?.organizationName ?? "");
  const [country, setCountry] = useState(existingEngagement?.country ?? "");
  const [reportingPeriodStart, setReportingPeriodStart] = useState(
    existingEngagement ? toDateInputValue(existingEngagement.reportingPeriodStart) : "",
  );
  const [reportingPeriodEnd, setReportingPeriodEnd] = useState(
    existingEngagement ? toDateInputValue(existingEngagement.reportingPeriodEnd) : "",
  );
  const [jurisdiction, setJurisdiction] = useState<GhgJurisdictionKey>(existingEngagement?.jurisdiction ?? "US_CALIFORNIA");
  const [numberOfSites, setNumberOfSites] = useState(
    existingEngagement?.numberOfSites != null ? String(existingEngagement.numberOfSites) : "",
  );

  const [scope1Entries, setScope1Entries] = useState<GhgScope1Entry[]>(existingEngagement?.scope1Entries ?? []);
  const [scope2Entries, setScope2Entries] = useState<GhgScope2Entry[]>(existingEngagement?.scope2Entries ?? []);

  const [calculation, setCalculation] = useState<GhgCalculationResult | null>(initialCalculation ?? null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ghgRunnerApi.listJurisdictions().then(({ jurisdictions }) => setJurisdictions(jurisdictions));
    referenceApi.emissionFactors().then((ref) => setFuels(ref.fuels));
  }, []);

  const selectedJurisdiction = jurisdictions?.find((j) => j.key === jurisdiction);

  const handleScope1SourceChange = (id: string, sourceType: string) => {
    if (sourceType === "CUSTOM") {
      setScope1Entries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, sourceType: "CUSTOM", isCustom: true, label: "Custom source", unit: "", source: "" } : e)),
      );
      return;
    }
    const fuel = fuels?.find((f) => f.key === sourceType);
    if (!fuel) return;
    setScope1Entries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, sourceType, isCustom: false, label: fuel.label, unit: fuel.unit, source: LIBRARY_DEFAULT_SOURCE, customFactorValue: undefined }
          : e,
      ),
    );
  };

  const updateScope1Row = (id: string, patch: Partial<GhgScope1Entry>) =>
    setScope1Entries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const updateScope2Row = (id: string, patch: Partial<GhgScope2Entry>) =>
    setScope2Entries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const handleCalculate = async () => {
    setError(null);
    setIsCalculating(true);
    try {
      const { calculation } = await ghgRunnerApi.calculate({ scope1Entries, scope2Entries, jurisdiction });
      setCalculation(calculation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't calculate emissions.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!organizationName.trim() || !country.trim() || !reportingPeriodStart || !reportingPeriodEnd) {
      setError("Organization name, country, and reporting period are required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const payload: GhgEngagementInput = {
        organizationName: organizationName.trim(),
        country: country.trim(),
        reportingPeriodStart,
        reportingPeriodEnd,
        jurisdiction,
        numberOfSites: numberOfSites ? Number(numberOfSites) : undefined,
        scope1Entries,
        scope2Entries,
        scope3Entries: existingEngagement?.scope3Entries ?? [],
      };
      const { engagement, calculation } = existingEngagement
        ? await ghgRunnerApi.update(existingEngagement.id, payload)
        : await ghgRunnerApi.create(payload);
      setCalculation(calculation);
      onSaved(engagement, calculation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this engagement.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <Alert variant="error">{error}</Alert>}

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-foreground">Engagement details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="org-name">Organization name</Label>
            <Input id="org-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="period-start">Reporting period start</Label>
            <Input id="period-start" type="date" value={reportingPeriodStart} onChange={(e) => setReportingPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="period-end">Reporting period end</Label>
            <Input id="period-end" type="date" value={reportingPeriodEnd} onChange={(e) => setReportingPeriodEnd(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Select id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as GhgJurisdictionKey)}>
              {(jurisdictions ?? []).map((j) => (
                <option key={j.key} value={j.key}>
                  {j.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sites">Number of sites (informational)</Label>
            <Input id="sites" type="number" min="1" value={numberOfSites} onChange={(e) => setNumberOfSites(e.target.value)} />
          </div>
        </div>
        {selectedJurisdiction && (
          <p className="mt-4 text-xs text-muted-foreground">
            {selectedJurisdiction.regulationLabel} · GWP table {selectedJurisdiction.gwp.scheme} (CO2={selectedJurisdiction.gwp.co2}, CH4=
            {selectedJurisdiction.gwp.ch4}, N2O={selectedJurisdiction.gwp.n2o}) · {selectedJurisdiction.gwpSource}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Scope 1 — Direct emissions</h2>
          <Button size="sm" variant="secondary" onClick={() => setScope1Entries((prev) => [...prev, emptyScope1Entry(fuels ?? [])])}>
            <Plus className="h-3.5 w-3.5" />
            Add source
          </Button>
        </div>
        {scope1Entries.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No Scope 1 sources added yet.</p>}
        <div className="mt-4 space-y-4">
          {scope1Entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-surface-border p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-2">
                  <Label>Source</Label>
                  <Select value={entry.sourceType} onChange={(e) => handleScope1SourceChange(entry.id, e.target.value)}>
                    {(fuels ?? []).map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                    <option value="CUSTOM">Custom factor…</option>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="any"
                    value={entry.quantity || ""}
                    onChange={(e) => updateScope1Row(entry.id, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={entry.unit}
                    disabled={!entry.isCustom}
                    onChange={(e) => updateScope1Row(entry.id, { unit: e.target.value })}
                  />
                </div>
                {entry.isCustom && (
                  <div>
                    <Label>Factor (tCO2e/unit)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={entry.customFactorValue ?? ""}
                      onChange={(e) => updateScope1Row(entry.id, { customFactorValue: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1">
                  <Label>Source citation</Label>
                  <Input
                    value={entry.source}
                    onChange={(e) => updateScope1Row(entry.id, { source: e.target.value })}
                    placeholder="Regulation / database this factor comes from"
                  />
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setScope1Entries((prev) => prev.filter((e) => e.id !== entry.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Scope 2 — Indirect emissions (electricity)</h2>
          <Button size="sm" variant="secondary" onClick={() => setScope2Entries((prev) => [...prev, emptyScope2Entry()])}>
            <Plus className="h-3.5 w-3.5" />
            Add source
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Grid emission factor is entered manually per country — never defaulted to India&apos;s CEA factor.
        </p>
        {scope2Entries.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No Scope 2 sources added yet.</p>}
        <div className="mt-4 space-y-4">
          {scope2Entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-surface-border p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={entry.label}
                    onChange={(e) => updateScope2Row(entry.id, { label: e.target.value })}
                    placeholder="e.g. Head office (UK)"
                  />
                </div>
                <div>
                  <Label>Consumption</Label>
                  <Input
                    type="number"
                    step="any"
                    value={entry.quantityValue || ""}
                    onChange={(e) => updateScope2Row(entry.id, { quantityValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select
                    value={entry.quantityUnit}
                    onChange={(e) => updateScope2Row(entry.id, { quantityUnit: e.target.value as "kWh" | "MWh" })}
                  >
                    <option value="kWh">kWh</option>
                    <option value="MWh">MWh</option>
                  </Select>
                </div>
                <div>
                  <Label>Grid factor (tCO2e/unit)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={entry.gridFactorValue || ""}
                    onChange={(e) => updateScope2Row(entry.id, { gridFactorValue: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1">
                  <Label>Source citation</Label>
                  <Input
                    value={entry.source}
                    onChange={(e) => updateScope2Row(entry.id, { source: e.target.value })}
                    placeholder="National grid authority / IEA / EPA eGRID, etc."
                  />
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setScope2Entries((prev) => prev.filter((e) => e.id !== entry.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 opacity-60">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Scope 3 — Value chain emissions</h2>
          <span className="rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Coming soon
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Category (1–15), description, quantity, factor, and source will be entered here once enabled — the data
          model already supports it.
        </p>
        <Button size="sm" variant="secondary" disabled className="mt-4">
          <Plus className="h-3.5 w-3.5" />
          Add Scope 3 item
        </Button>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleCalculate} isLoading={isCalculating}>
          <Calculator className="h-4 w-4" />
          Calculate
        </Button>
        <Button onClick={handleSave} isLoading={isSaving}>
          {existingEngagement ? "Save changes" : "Save draft"}
        </Button>
      </div>

      {calculation && <GhgBreakdownView calculation={calculation} />}
    </div>
  );
}
