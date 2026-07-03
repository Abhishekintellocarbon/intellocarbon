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
import { activityDataApi, companyApi, referenceApi, ApiError } from "@/lib/api";
import type { EmissionFactorReference, Sector } from "@/lib/types";
import { FUEL_UNIT_LABELS, HYDROGEN_ROUTE_OPTIONS } from "@/lib/constants";

export function ActivityDataForm({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState<EmissionFactorReference | null>(null);
  const [sector, setSector] = useState<Sector>("STEEL");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([referenceApi.emissionFactors(), companyApi.getMine()])
      .then(([ref, { company }]) => {
        setReference(ref);
        if (company) setSector(company.sector);
      })
      .catch(() => setServerError("Couldn't load emission factor reference data."));
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
  const watchedHydrogenRoute = watch("hydrogenRoute");
  const watchedElectricityExported = watch("electricityExportedEuMwh");
  const watchedN2o = watch("n2oProcessEmissionsTonnes");

  const sectorFuels = reference?.fuels.filter((f) => f.sectors.includes(sector)) ?? [];
  const sectorMaterials = reference?.processMaterials.filter((m) => m.sectors.includes(sector)) ?? [];
  const sectorPrecursors = reference?.precursors.filter((p) => p.sectors.includes(sector)) ?? [];

  const onSubmit = async (data: ActivityDataFormValues) => {
    setServerError(null);
    try {
      const isElectricity = sector === "ELECTRICITY";
      const { entry } = await activityDataApi.create(facilityId, {
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        productCategory: data.productCategory,
        // Electricity's CBAM SEE is per MWh exported to the EU — that field
        // doubles as the calculation denominator, so no separate tonnage input.
        productionQuantityT: isElectricity
          ? Number(data.electricityExportedEuMwh || 0)
          : Number(data.productionQuantityT),
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

        limestoneInputTonnes: data.limestoneInputTonnes ? Number(data.limestoneInputTonnes) : undefined,
        clinkerProducedTonnes: data.clinkerProducedTonnes ? Number(data.clinkerProducedTonnes) : undefined,
        clinkerConversionFraction: data.clinkerConversionFraction
          ? Number(data.clinkerConversionFraction)
          : undefined,

        cf4EmissionsTonnes: data.cf4EmissionsTonnes ? Number(data.cf4EmissionsTonnes) : undefined,
        c2f6EmissionsTonnes: data.c2f6EmissionsTonnes ? Number(data.c2f6EmissionsTonnes) : undefined,
        anodeEffectMinutes: data.anodeEffectMinutes ? Number(data.anodeEffectMinutes) : undefined,

        n2oProcessEmissionsTonnes: data.n2oProcessEmissionsTonnes
          ? Number(data.n2oProcessEmissionsTonnes)
          : undefined,
        n2oAbatementFactorPct: data.n2oAbatementFactorPct ? Number(data.n2oAbatementFactorPct) : undefined,
        naturalGasFeedstockNm3: data.naturalGasFeedstockNm3 ? Number(data.naturalGasFeedstockNm3) : undefined,

        hydrogenRoute: data.hydrogenRoute || undefined,
        ccsCaptureRatePct: data.ccsCaptureRatePct ? Number(data.ccsCaptureRatePct) : undefined,
        hydrogenPurityPct: data.hydrogenPurityPct ? Number(data.hydrogenPurityPct) : undefined,
        byproductOxygenTonnes: data.byproductOxygenTonnes ? Number(data.byproductOxygenTonnes) : undefined,

        electricityGeneratedMwh: data.electricityGeneratedMwh ? Number(data.electricityGeneratedMwh) : undefined,
        electricityExportedEuMwh: data.electricityExportedEuMwh ? Number(data.electricityExportedEuMwh) : undefined,
        ownUseElectricityMwh: data.ownUseElectricityMwh ? Number(data.ownUseElectricityMwh) : undefined,
        lineLossMwh: data.lineLossMwh ? Number(data.lineLossMwh) : undefined,

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

  const suggestedN2o =
    sector === "FERTILIZER" ? Number(watch("productionQuantityT") || 0) * reference.n2oDefaultEf.tonnesPerTonneNitricAcid : 0;

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
              placeholder={sector === "FERTILIZER" ? "Ammonia, Urea, Nitric Acid..." : "Crude Steel"}
              error={Boolean(errors.productCategory)}
              {...register("productCategory")}
            />
            <FieldError message={errors.productCategory?.message} />
          </div>
          {sector !== "ELECTRICITY" && (
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
          )}
        </div>
      </Card>

      {sector === "CEMENT" && (
        <Card className="p-6">
          <h2 className="font-medium">Cement — calcination & clinker</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Calcination of raw limestone is the dominant emission source for cement — it is calculated as
            limestone input x {reference.cementCalcinationEmissionFactor} tCO2/t CaCO3 x the fraction converted
            to clinker, and shown as a separate line in your reports.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="limestoneInputTonnes">Raw limestone input (tonnes)</Label>
              <Input id="limestoneInputTonnes" type="number" step="any" placeholder="150000" {...register("limestoneInputTonnes")} />
            </div>
            <div>
              <Label htmlFor="clinkerConversionFraction">
                Fraction converted to clinker <span className="text-muted">(0-1, default 1)</span>
              </Label>
              <Input id="clinkerConversionFraction" type="number" step="any" min="0" max="1" placeholder="1" {...register("clinkerConversionFraction")} />
              <FieldError message={errors.clinkerConversionFraction?.message} />
            </div>
            <div>
              <Label htmlFor="clinkerProducedTonnes">Clinker produced (tonnes)</Label>
              <Input id="clinkerProducedTonnes" type="number" step="any" placeholder="95000" {...register("clinkerProducedTonnes")} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Fly ash, slag and gypsum added, plus clinker purchased externally, are entered below under Process
            materials / Precursor materials — all carry a zero direct process emission factor except purchased
            clinker, which brings its supplier&apos;s embedded emissions.
          </p>
        </Card>
      )}

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
            const selectedUnit = sectorFuels.find((f) => f.key === watchedFuels?.[index]?.fuelType)?.unit;
            return (
              <div key={field.id} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <Select error={Boolean(errors.fuelEntries?.[index]?.fuelType)} {...register(`fuelEntries.${index}.fuelType`)}>
                    <option value="">Select fuel</option>
                    {sectorFuels.map((f) => (
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

      {sector === "FERTILIZER" && (
        <Card className="p-6">
          <h2 className="font-medium">Fertilizer — natural gas feedstock</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Natural gas is both a fuel and a feedstock for ammonia synthesis. Enter fuel use above under Fuel &amp;
            energy consumption, and the feedstock carbon input here — tracked and shown as a separate line, since
            it is not combustion.
          </p>
          <div className="mt-4">
            <Label htmlFor="naturalGasFeedstockNm3">Natural gas feedstock (&apos;000 Nm3)</Label>
            <Input id="naturalGasFeedstockNm3" type="number" step="any" placeholder="500" {...register("naturalGasFeedstockNm3")} />
          </div>
        </Card>
      )}

      {sector === "FERTILIZER" && (
        <Card className="p-6">
          <h2 className="font-medium">N2O process emissions — nitric acid (Ostwald process)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Nitrous oxide is released during catalytic oxidation of ammonia in nitric acid production. It
            typically accounts for 60-70% of total GHG emissions at a nitric acid plant, so it is shown
            separately rather than folded into fuel combustion. IPCC 2006 default: {" "}
            {reference.n2oDefaultEf.tonnesPerTonneNitricAcid * 1000} kg N2O per tonne nitric acid produced
            (uncontrolled) — {reference.n2oDefaultEf.source}.
            {suggestedN2o > 0 && (
              <> Based on your production quantity, the uncontrolled default would be ~{suggestedN2o.toFixed(2)} t N2O.</>
            )}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="n2oProcessEmissionsTonnes">N2O emitted (tonnes)</Label>
              <Input id="n2oProcessEmissionsTonnes" type="number" step="any" placeholder="45" {...register("n2oProcessEmissionsTonnes")} />
            </div>
            <div>
              <Label htmlFor="n2oAbatementFactorPct">
                Abatement factor <span className="text-muted">(%, if N2O catalyst installed)</span>
              </Label>
              <Input id="n2oAbatementFactorPct" type="number" step="any" min="0" max="100" placeholder="0" {...register("n2oAbatementFactorPct")} />
            </div>
          </div>
          {watchedN2o && (
            <p className="mt-2 text-xs text-muted-foreground">
              This will be converted to CO2e using AR5 (CBAM, GWP 265) and AR2/BUR3 (CCTS, GWP 310).
            </p>
          )}
        </Card>
      )}

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
          {sector === "ALUMINIUM"
            ? "Anode carbon / petroleum coke and pitch consumed — the carbon oxidation reaction in Hall-Héroult electrolysis. Alumina, cryolite and aluminium fluoride carry no direct process emission but can be recorded for mass balance."
            : sector === "CEMENT"
              ? "Fly ash, slag and gypsum added — zero process emission, recorded for clinker-to-cement ratio and mass balance."
              : "Calcination of flux materials (limestone, dolomite) — process CO2 emissions."}
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
                  {sectorMaterials.map((m) => (
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

      {sector === "ALUMINIUM" && (
        <Card className="p-6">
          <h2 className="font-medium">PFC emissions — anode effects</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Perfluorocarbons (CF4, C2F6) are released during anode effects — voltage excursions in the
            electrolysis cell caused by alumina depletion at the anode. They carry very high Global Warming
            Potentials and are shown separately from other aluminium process emissions. CBAM uses AR5 GWPs
            (CF4 = 6630, C2F6 = 11100); CCTS uses AR2/BUR3-gazetted GWPs (CF4 = 6500, C2F6 = 9200).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="cf4EmissionsTonnes">CF4 emissions (tonnes)</Label>
              <Input id="cf4EmissionsTonnes" type="number" step="any" placeholder="0.05" {...register("cf4EmissionsTonnes")} />
            </div>
            <div>
              <Label htmlFor="c2f6EmissionsTonnes">C2F6 emissions (tonnes)</Label>
              <Input id="c2f6EmissionsTonnes" type="number" step="any" placeholder="0.005" {...register("c2f6EmissionsTonnes")} />
            </div>
            <div>
              <Label htmlFor="anodeEffectMinutes">
                Anode effect minutes / cell-day <span className="text-muted">(optional, for estimation)</span>
              </Label>
              <Input id="anodeEffectMinutes" type="number" step="any" placeholder="0.3" {...register("anodeEffectMinutes")} />
            </div>
          </div>
        </Card>
      )}

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
          Purchased materials with embedded emissions from an external supplier — enter source country/supplier
          and use the verified or default embedded emission factor.
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
                  {sectorPrecursors.map((p) => (
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
              <Input placeholder="Supplier / source country (optional)" {...register(`precursorEntries.${index}.sourceLabel`)} />
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
        {sector === "HYDROGEN" && (
          <p className="mt-1 text-xs text-muted-foreground">
            For electrolysis routes, electricity consumption is the critical input. Use grid electricity for
            India-grid sourced power, renewable/captive electricity for dedicated renewable supply (zero-rated),
            or enter both plus a blended override factor for a mixed source.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="gridElectricityMwh">Grid electricity purchased (MWh)</Label>
            <Input id="gridElectricityMwh" type="number" step="any" placeholder="45000" {...register("gridElectricityMwh")} />
          </div>
          <div>
            <Label htmlFor="renewableElectricityMwh">
              Renewable / captive electricity (MWh) <span className="text-muted">(zero-rated)</span>
            </Label>
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

      {sector === "HYDROGEN" && (
        <Card className="p-6">
          <h2 className="font-medium">Hydrogen — production route</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The production route drives almost the entire emission profile — select it first. Green hydrogen
            from dedicated renewable electricity with zero grid connection can have a near-zero SEE; the
            platform handles this correctly rather than treating it as an error.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="hydrogenRoute">Production route</Label>
              <Select id="hydrogenRoute" {...register("hydrogenRoute")}>
                <option value="">Select route</option>
                {HYDROGEN_ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {watchedHydrogenRoute === "SMR_CCS" && (
              <div>
                <Label htmlFor="ccsCaptureRatePct">CCS capture rate (%)</Label>
                <Input id="ccsCaptureRatePct" type="number" step="any" min="0" max="100" placeholder="90" {...register("ccsCaptureRatePct")} />
              </div>
            )}
            <div>
              <Label htmlFor="hydrogenPurityPct">
                Hydrogen purity (%) <span className="text-muted">(optional)</span>
              </Label>
              <Input id="hydrogenPurityPct" type="number" step="any" min="0" max="100" placeholder="99.9" {...register("hydrogenPurityPct")} />
            </div>
            <div>
              <Label htmlFor="byproductOxygenTonnes">
                By-product oxygen (tonnes) <span className="text-muted">(optional, for records)</span>
              </Label>
              <Input id="byproductOxygenTonnes" type="number" step="any" placeholder="8000" {...register("byproductOxygenTonnes")} />
            </div>
          </div>
        </Card>
      )}

      {sector === "ELECTRICITY" && (
        <Card className="p-6">
          <h2 className="font-medium">Electricity generation & export</h2>
          <Alert variant="info">
            EU CBAM for electricity applies to electricity physically transmitted to EU customs territory.
            Indian exporters should confirm with their EU buyer whether this sector applies before completing
            this form.
          </Alert>
          <p className="mt-3 text-xs text-muted-foreground">
            SEE for this sector is per MWh, not per tonne — it applies only to the quantity exported to the EU.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="electricityGeneratedMwh">Total electricity generated (MWh)</Label>
              <Input id="electricityGeneratedMwh" type="number" step="any" placeholder="500000" {...register("electricityGeneratedMwh")} />
            </div>
            <div>
              <Label htmlFor="electricityExportedEuMwh">Electricity exported to the EU (MWh)</Label>
              <Input id="electricityExportedEuMwh" type="number" step="any" placeholder="10000" error={Boolean(errors.productionQuantityT)} {...register("electricityExportedEuMwh")} />
              <FieldError message={errors.productionQuantityT?.message} />
            </div>
            <div>
              <Label htmlFor="ownUseElectricityMwh">Own use electricity (MWh)</Label>
              <Input id="ownUseElectricityMwh" type="number" step="any" placeholder="15000" {...register("ownUseElectricityMwh")} />
            </div>
            <div>
              <Label htmlFor="lineLossMwh">Line losses (MWh)</Label>
              <Input id="lineLossMwh" type="number" step="any" placeholder="5000" {...register("lineLossMwh")} />
            </div>
          </div>
          {!watchedElectricityExported && (
            <p className="mt-2 text-xs text-danger">Enter the MWh exported to the EU to calculate SEE for this period.</p>
          )}
        </Card>
      )}

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
