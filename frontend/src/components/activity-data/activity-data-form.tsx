"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flame, Loader2, Package, Plus, Recycle, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { activityDataSchema, type ActivityDataFormValues } from "@/lib/validations/activity-data";
import { activityDataApi, referenceApi, ApiError } from "@/lib/api";
import type { EmissionFactorReference } from "@/lib/types";
import { FUEL_UNIT_LABELS } from "@/lib/constants";

export function ActivityDataForm({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState<EmissionFactorReference | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    referenceApi.emissionFactors().then(setReference).catch(() => setServerError("Couldn't load emission factor reference data."));
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ActivityDataFormValues>({
    resolver: zodResolver(activityDataSchema),
    defaultValues: {
      fuelEntries: [],
      processMaterialEntries: [],
      precursorEntries: [],
    },
  });

  const fuelArray = useFieldArray({ control, name: "fuelEntries" });
  const materialArray = useFieldArray({ control, name: "processMaterialEntries" });
  const precursorArray = useFieldArray({ control, name: "precursorEntries" });

  const watchedFuels = watch("fuelEntries");

  const onSubmit = async (data: ActivityDataFormValues) => {
    setServerError(null);
    try {
      const { entry } = await activityDataApi.create(facilityId, {
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        productCategory: data.productCategory,
        productionQuantityT: Number(data.productionQuantityT),
        gridElectricityMwh: data.gridElectricityMwh ? Number(data.gridElectricityMwh) : 0,
        renewableElectricityMwh: data.renewableElectricityMwh ? Number(data.renewableElectricityMwh) : 0,
        gridEmissionFactorOverride: data.gridEmissionFactorOverride
          ? Number(data.gridEmissionFactorOverride)
          : undefined,
        steamImportedGj: data.steamImportedGj ? Number(data.steamImportedGj) : 0,
        steamEmissionFactorOverride: data.steamEmissionFactorOverride
          ? Number(data.steamEmissionFactorOverride)
          : undefined,
        carbonPricePaidEurPerTonne: data.carbonPricePaidEurPerTonne
          ? Number(data.carbonPricePaidEurPerTonne)
          : undefined,
        cctsTargetIntensity: data.cctsTargetIntensity ? Number(data.cctsTargetIntensity) : undefined,
        notes: data.notes || undefined,
        fuelEntries: data.fuelEntries.map((f) => ({
          fuelType: f.fuelType,
          quantity: Number(f.quantity),
          unit: reference?.fuels.find((def) => def.key === f.fuelType)?.unit ?? "TONNE",
        })),
        processMaterialEntries: data.processMaterialEntries.map((m) => ({
          materialType: m.materialType,
          quantityTonnes: Number(m.quantityTonnes),
        })),
        precursorEntries: data.precursorEntries.map((p) => ({
          materialType: p.materialType,
          quantityTonnes: Number(p.quantityTonnes),
          sourceLabel: p.sourceLabel || undefined,
        })),
      });
      router.push(`/facilities/${facilityId}/data-entry/${entry.id}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (!reference) {
    return (
      <div className="flex justify-center py-20">
        {serverError ? <p className="text-sm text-danger">{serverError}</p> : <Loader2 className="h-6 w-6 animate-spin text-teal-500" />}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Card className="p-6">
        <h2 className="font-medium">Reporting period & production</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="periodStart">Period start</Label>
            <Input id="periodStart" type="date" error={Boolean(errors.periodStart)} {...register("periodStart")} />
            <FieldError message={errors.periodStart?.message} />
          </div>
          <div>
            <Label htmlFor="periodEnd">Period end</Label>
            <Input id="periodEnd" type="date" error={Boolean(errors.periodEnd)} {...register("periodEnd")} />
            <FieldError message={errors.periodEnd?.message} />
          </div>
          <div>
            <Label htmlFor="productCategory">Product category</Label>
            <Input
              id="productCategory"
              placeholder="Crude Steel"
              error={Boolean(errors.productCategory)}
              {...register("productCategory")}
            />
            <FieldError message={errors.productCategory?.message} />
          </div>
          <div>
            <Label htmlFor="productionQuantityT">Production quantity (tonnes)</Label>
            <Input
              id="productionQuantityT"
              type="number"
              step="any"
              placeholder="100000"
              error={Boolean(errors.productionQuantityT)}
              {...register("productionQuantityT")}
            />
            <FieldError message={errors.productionQuantityT?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-teal-500" />
            <h2 className="font-medium">Fuel & energy consumption</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fuelArray.append({ fuelType: "", quantity: "" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add fuel
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Direct combustion emissions (Scope 1) are calculated from these entries using IPCC 2006 default
          factors — indicative values, editable per line.
        </p>

        <div className="mt-4 space-y-3">
          {fuelArray.fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-surface-border px-4 py-6 text-center text-sm text-muted">
              No fuels added yet.
            </p>
          )}
          {fuelArray.fields.map((field, index) => {
            const selectedUnit = reference.fuels.find((f) => f.key === watchedFuels?.[index]?.fuelType)?.unit;
            return (
              <div key={field.id} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <Select error={Boolean(errors.fuelEntries?.[index]?.fuelType)} {...register(`fuelEntries.${index}.fuelType`)}>
                    <option value="">Select fuel</option>
                    {reference.fuels.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.fuelEntries?.[index]?.fuelType?.message} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Qty"
                      error={Boolean(errors.fuelEntries?.[index]?.quantity)}
                      {...register(`fuelEntries.${index}.quantity`)}
                    />
                    <FieldError message={errors.fuelEntries?.[index]?.quantity?.message} />
                  </div>
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {selectedUnit ? FUEL_UNIT_LABELS[selectedUnit] : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fuelArray.remove(index)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-border text-muted hover:border-danger/40 hover:text-danger"
                  aria-label="Remove fuel row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-500" />
            <h2 className="font-medium">Process materials</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => materialArray.append({ materialType: "", quantityTonnes: "" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add material
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Calcination of flux materials (limestone, dolomite) — process CO2 emissions.
        </p>

        <div className="mt-4 space-y-3">
          {materialArray.fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-surface-border px-4 py-6 text-center text-sm text-muted">
              No process materials added yet.
            </p>
          )}
          {materialArray.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div>
                <Select
                  error={Boolean(errors.processMaterialEntries?.[index]?.materialType)}
                  {...register(`processMaterialEntries.${index}.materialType`)}
                >
                  <option value="">Select material</option>
                  {reference.processMaterials.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.processMaterialEntries?.[index]?.materialType?.message} />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  step="any"
                  placeholder="Tonnes"
                  error={Boolean(errors.processMaterialEntries?.[index]?.quantityTonnes)}
                  {...register(`processMaterialEntries.${index}.quantityTonnes`)}
                />
                <FieldError message={errors.processMaterialEntries?.[index]?.quantityTonnes?.message} />
              </div>
              <button
                type="button"
                onClick={() => materialArray.remove(index)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-border text-muted hover:border-danger/40 hover:text-danger"
                aria-label="Remove material row"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-teal-500" />
            <h2 className="font-medium">Precursor materials</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => precursorArray.append({ materialType: "", quantityTonnes: "", sourceLabel: "" })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add precursor
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Purchased pig iron, DRI, scrap or ferro-alloys — embedded emissions counted for CBAM.
        </p>

        <div className="mt-4 space-y-3">
          {precursorArray.fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-surface-border px-4 py-6 text-center text-sm text-muted">
              No precursor materials added yet.
            </p>
          )}
          {precursorArray.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
              <div>
                <Select
                  error={Boolean(errors.precursorEntries?.[index]?.materialType)}
                  {...register(`precursorEntries.${index}.materialType`)}
                >
                  <option value="">Select material</option>
                  {reference.precursors.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.precursorEntries?.[index]?.materialType?.message} />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  step="any"
                  placeholder="Tonnes"
                  error={Boolean(errors.precursorEntries?.[index]?.quantityTonnes)}
                  {...register(`precursorEntries.${index}.quantityTonnes`)}
                />
                <FieldError message={errors.precursorEntries?.[index]?.quantityTonnes?.message} />
              </div>
              <Input placeholder="Supplier (optional)" {...register(`precursorEntries.${index}.sourceLabel`)} />
              <button
                type="button"
                onClick={() => precursorArray.remove(index)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-surface-border text-muted hover:border-danger/40 hover:text-danger"
                aria-label="Remove precursor row"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-400" />
          <h2 className="font-medium">Electricity & steam (indirect, Scope 2)</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="gridElectricityMwh">Grid electricity purchased (MWh)</Label>
            <Input id="gridElectricityMwh" type="number" step="any" placeholder="45000" {...register("gridElectricityMwh")} />
          </div>
          <div>
            <Label htmlFor="renewableElectricityMwh">Renewable / captive electricity (MWh)</Label>
            <Input
              id="renewableElectricityMwh"
              type="number"
              step="any"
              placeholder="5000"
              {...register("renewableElectricityMwh")}
            />
          </div>
          <div>
            <Label htmlFor="gridEmissionFactorOverride">
              Grid emission factor override (tCO2/MWh){" "}
              <span className="text-muted">(default {reference.defaultGridEmissionFactor})</span>
            </Label>
            <Input id="gridEmissionFactorOverride" type="number" step="any" placeholder={String(reference.defaultGridEmissionFactor)} {...register("gridEmissionFactorOverride")} />
          </div>
          <div>
            <Label htmlFor="steamImportedGj">Steam imported (GJ)</Label>
            <Input id="steamImportedGj" type="number" step="any" placeholder="2000" {...register("steamImportedGj")} />
          </div>
          <div>
            <Label htmlFor="steamEmissionFactorOverride">
              Steam emission factor override (tCO2/GJ){" "}
              <span className="text-muted">(default {reference.defaultSteamEmissionFactor})</span>
            </Label>
            <Input id="steamEmissionFactorOverride" type="number" step="any" placeholder="0.07" {...register("steamEmissionFactorOverride")} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">CBAM &amp; CCTS reporting inputs</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="carbonPricePaidEurPerTonne">
              Carbon price paid in India (EUR/tCO2e) <span className="text-muted">(optional)</span>
            </Label>
            <Input
              id="carbonPricePaidEurPerTonne"
              type="number"
              step="any"
              placeholder="4.50"
              {...register("carbonPricePaidEurPerTonne")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used for the CBAM Article 9 deduction — the carbon price effectively paid in the country of origin.
            </p>
          </div>
          <div>
            <Label htmlFor="cctsTargetIntensity">
              CCTS notified GHG intensity target (tCO2e/t) <span className="text-muted">(optional)</span>
            </Label>
            <Input
              id="cctsTargetIntensity"
              type="number"
              step="any"
              placeholder="1.85"
              {...register("cctsTargetIntensity")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your BEE-notified target for this reporting cycle, if known — used for the CCTS CCC surplus/deficit position.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <Label htmlFor="notes">
          Notes <span className="text-muted">(optional)</span>
        </Label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
          placeholder="Anything an assessor should know about this reporting period"
          {...register("notes")}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? "Calculating emissions..." : "Save & calculate emissions"}
        </Button>
      </div>
    </form>
  );
}
