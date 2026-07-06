"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import { brsrCoreSchema, type BrsrCoreFormValues } from "@/lib/validations/brsr";
import { brsrApi, ApiError } from "@/lib/api";
import type { BrsrCoreReport } from "@/lib/types";

const toStr = (v: number | null | undefined) => (v != null ? String(v) : "");

export function BrsrCoreForm({
  facilityId,
  reportingPeriod,
  existingReport,
}: {
  facilityId: string;
  reportingPeriod: string;
  existingReport?: BrsrCoreReport;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Autosave is only safe while the report is still a draft — the backend
  // rejects a non-submit save once it's SUBMITTED (resubmission must be
  // explicit), so a submitted report only saves via the Submit button below.
  const isAlreadySubmitted = existingReport?.status === "SUBMITTED";

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BrsrCoreFormValues>({
    resolver: zodResolver(brsrCoreSchema),
    defaultValues: {
      reportingPeriod,
      turnoverInr: toStr(existingReport?.turnoverInr),
      waterWithdrawnKl: toStr(existingReport?.waterWithdrawnKl),
      waterDischargedKl: toStr(existingReport?.waterDischargedKl),
      wasteGeneratedTonnes: toStr(existingReport?.wasteGeneratedTonnes),
      wasteRecoveredTonnes: toStr(existingReport?.wasteRecoveredTonnes),
      renewableEnergyConsumptionGj: toStr(existingReport?.renewableEnergyConsumptionGj),
      nonRenewableEnergyConsumptionGj: toStr(existingReport?.nonRenewableEnergyConsumptionGj),
      employeeCountTotal: toStr(existingReport?.employeeCountTotal),
      employeeCountFemale: toStr(existingReport?.employeeCountFemale),
      wagesPaidMaleInr: toStr(existingReport?.wagesPaidMaleInr),
      wagesPaidFemaleInr: toStr(existingReport?.wagesPaidFemaleInr),
      safetyIncidentsCount: toStr(existingReport?.safetyIncidentsCount),
      womenInWorkforcePct: toStr(existingReport?.womenInWorkforcePct),
      womenInManagementPct: toStr(existingReport?.womenInManagementPct),
      procurementFromMsmePct: toStr(existingReport?.procurementFromMsmePct),
      purchasesFromTop10SuppliersPct: toStr(existingReport?.purchasesFromTop10SuppliersPct),
      salesToTop10CustomersPct: toStr(existingReport?.salesToTop10CustomersPct),
      consumerComplaintsCount: toStr(existingReport?.consumerComplaintsCount),
      consumerComplaintsResolvedPct: toStr(existingReport?.consumerComplaintsResolvedPct),
      notes: existingReport?.notes ?? "",
    },
  });

  const buildPayload = (data: Partial<BrsrCoreFormValues>) => ({
    reportingPeriod,
    turnoverInr: data.turnoverInr || undefined,
    waterWithdrawnKl: data.waterWithdrawnKl || undefined,
    waterDischargedKl: data.waterDischargedKl || undefined,
    wasteGeneratedTonnes: data.wasteGeneratedTonnes || undefined,
    wasteRecoveredTonnes: data.wasteRecoveredTonnes || undefined,
    renewableEnergyConsumptionGj: data.renewableEnergyConsumptionGj || undefined,
    nonRenewableEnergyConsumptionGj: data.nonRenewableEnergyConsumptionGj || undefined,
    employeeCountTotal: data.employeeCountTotal || undefined,
    employeeCountFemale: data.employeeCountFemale || undefined,
    wagesPaidMaleInr: data.wagesPaidMaleInr || undefined,
    wagesPaidFemaleInr: data.wagesPaidFemaleInr || undefined,
    safetyIncidentsCount: data.safetyIncidentsCount || undefined,
    womenInWorkforcePct: data.womenInWorkforcePct || undefined,
    womenInManagementPct: data.womenInManagementPct || undefined,
    procurementFromMsmePct: data.procurementFromMsmePct || undefined,
    purchasesFromTop10SuppliersPct: data.purchasesFromTop10SuppliersPct || undefined,
    salesToTop10CustomersPct: data.salesToTop10CustomersPct || undefined,
    consumerComplaintsCount: data.consumerComplaintsCount || undefined,
    consumerComplaintsResolvedPct: data.consumerComplaintsResolvedPct || undefined,
    notes: data.notes || undefined,
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    await brsrApi.save(facilityId, buildPayload(getValues()), false);
  });

  const autosaveField = (name: Path<BrsrCoreFormValues>): UseFormRegisterReturn => {
    const field = register(name);
    if (isAlreadySubmitted) return field;
    return {
      ...field,
      onBlur: (e) => {
        const result = field.onBlur(e);
        triggerAutosave();
        return result;
      },
    };
  };

  const onSubmit = async (data: BrsrCoreFormValues) => {
    setServerError(null);
    try {
      await brsrApi.save(facilityId, buildPayload(data), true);
      router.push(`/facilities/${facilityId}/brsr/${encodeURIComponent(reportingPeriod)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reporting period <span className="font-medium text-foreground">{reportingPeriod}</span>
        </p>
        {!isAlreadySubmitted && <AutosaveIndicator status={autosaveStatus} />}
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}
      {isAlreadySubmitted && (
        <Alert variant="info">
          This disclosure has already been submitted. Changes here only save when you resubmit below.
        </Alert>
      )}

      <Card className="p-6">
        <h2 className="font-medium">Turnover</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Used as the denominator for every &ldquo;per rupee of turnover&rdquo; intensity ratio. Leave blank to fall
          back to the company&apos;s annual turnover.
        </p>
        <div className="mt-4 max-w-xs">
          <Label htmlFor="turnoverInr">Turnover (Rs.)</Label>
          <Input id="turnoverInr" inputMode="decimal" error={Boolean(errors.turnoverInr)} {...autosaveField("turnoverInr")} />
          <FieldError message={errors.turnoverInr?.message} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Water footprint</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="waterWithdrawnKl">Water withdrawn (KL)</Label>
            <Input id="waterWithdrawnKl" inputMode="decimal" error={Boolean(errors.waterWithdrawnKl)} {...autosaveField("waterWithdrawnKl")} />
            <FieldError message={errors.waterWithdrawnKl?.message} />
          </div>
          <div>
            <Label htmlFor="waterDischargedKl">Water discharged (KL)</Label>
            <Input id="waterDischargedKl" inputMode="decimal" error={Boolean(errors.waterDischargedKl)} {...autosaveField("waterDischargedKl")} />
            <FieldError message={errors.waterDischargedKl?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Waste management</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="wasteGeneratedTonnes">Waste generated (t)</Label>
            <Input id="wasteGeneratedTonnes" inputMode="decimal" error={Boolean(errors.wasteGeneratedTonnes)} {...autosaveField("wasteGeneratedTonnes")} />
            <FieldError message={errors.wasteGeneratedTonnes?.message} />
          </div>
          <div>
            <Label htmlFor="wasteRecoveredTonnes">Waste recovered / recycled (t)</Label>
            <Input id="wasteRecoveredTonnes" inputMode="decimal" error={Boolean(errors.wasteRecoveredTonnes)} {...autosaveField("wasteRecoveredTonnes")} />
            <FieldError message={errors.wasteRecoveredTonnes?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Energy footprint</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The renewable / non-renewable split only — electricity and steam energy already on this facility&apos;s
          activity data is reused automatically in the report.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="renewableEnergyConsumptionGj">Renewable energy consumption (GJ)</Label>
            <Input
              id="renewableEnergyConsumptionGj"
              inputMode="decimal"
              error={Boolean(errors.renewableEnergyConsumptionGj)}
              {...autosaveField("renewableEnergyConsumptionGj")}
            />
            <FieldError message={errors.renewableEnergyConsumptionGj?.message} />
          </div>
          <div>
            <Label htmlFor="nonRenewableEnergyConsumptionGj">Non-renewable energy consumption (GJ)</Label>
            <Input
              id="nonRenewableEnergyConsumptionGj"
              inputMode="decimal"
              error={Boolean(errors.nonRenewableEnergyConsumptionGj)}
              {...autosaveField("nonRenewableEnergyConsumptionGj")}
            />
            <FieldError message={errors.nonRenewableEnergyConsumptionGj?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Employee wellbeing and safety</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="employeeCountTotal">Total employees</Label>
            <Input id="employeeCountTotal" inputMode="numeric" error={Boolean(errors.employeeCountTotal)} {...autosaveField("employeeCountTotal")} />
            <FieldError message={errors.employeeCountTotal?.message} />
          </div>
          <div>
            <Label htmlFor="employeeCountFemale">Female employees</Label>
            <Input id="employeeCountFemale" inputMode="numeric" error={Boolean(errors.employeeCountFemale)} {...autosaveField("employeeCountFemale")} />
            <FieldError message={errors.employeeCountFemale?.message} />
          </div>
          <div>
            <Label htmlFor="wagesPaidMaleInr">Wages paid — male (Rs.)</Label>
            <Input id="wagesPaidMaleInr" inputMode="decimal" error={Boolean(errors.wagesPaidMaleInr)} {...autosaveField("wagesPaidMaleInr")} />
            <FieldError message={errors.wagesPaidMaleInr?.message} />
          </div>
          <div>
            <Label htmlFor="wagesPaidFemaleInr">Wages paid — female (Rs.)</Label>
            <Input id="wagesPaidFemaleInr" inputMode="decimal" error={Boolean(errors.wagesPaidFemaleInr)} {...autosaveField("wagesPaidFemaleInr")} />
            <FieldError message={errors.wagesPaidFemaleInr?.message} />
          </div>
          <div>
            <Label htmlFor="safetyIncidentsCount">Safety incidents reported</Label>
            <Input id="safetyIncidentsCount" inputMode="numeric" error={Boolean(errors.safetyIncidentsCount)} {...autosaveField("safetyIncidentsCount")} />
            <FieldError message={errors.safetyIncidentsCount?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Gender diversity</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="womenInWorkforcePct">Women in workforce (%)</Label>
            <Input id="womenInWorkforcePct" inputMode="decimal" error={Boolean(errors.womenInWorkforcePct)} {...autosaveField("womenInWorkforcePct")} />
            <FieldError message={errors.womenInWorkforcePct?.message} />
          </div>
          <div>
            <Label htmlFor="womenInManagementPct">Women in management / board (%)</Label>
            <Input id="womenInManagementPct" inputMode="decimal" error={Boolean(errors.womenInManagementPct)} {...autosaveField("womenInManagementPct")} />
            <FieldError message={errors.womenInManagementPct?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Inclusive development</h2>
        <div className="mt-4 max-w-xs">
          <Label htmlFor="procurementFromMsmePct">Procurement from MSMEs / small producers (%)</Label>
          <Input
            id="procurementFromMsmePct"
            inputMode="decimal"
            error={Boolean(errors.procurementFromMsmePct)}
            {...autosaveField("procurementFromMsmePct")}
          />
          <FieldError message={errors.procurementFromMsmePct?.message} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Openness of business</h2>
        <p className="mt-1 text-xs text-muted-foreground">Concentration risk disclosure.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="purchasesFromTop10SuppliersPct">Purchases from top 10 suppliers (%)</Label>
            <Input
              id="purchasesFromTop10SuppliersPct"
              inputMode="decimal"
              error={Boolean(errors.purchasesFromTop10SuppliersPct)}
              {...autosaveField("purchasesFromTop10SuppliersPct")}
            />
            <FieldError message={errors.purchasesFromTop10SuppliersPct?.message} />
          </div>
          <div>
            <Label htmlFor="salesToTop10CustomersPct">Sales to top 10 customers (%)</Label>
            <Input
              id="salesToTop10CustomersPct"
              inputMode="decimal"
              error={Boolean(errors.salesToTop10CustomersPct)}
              {...autosaveField("salesToTop10CustomersPct")}
            />
            <FieldError message={errors.salesToTop10CustomersPct?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Customer fairness</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="consumerComplaintsCount">Consumer complaints received</Label>
            <Input
              id="consumerComplaintsCount"
              inputMode="numeric"
              error={Boolean(errors.consumerComplaintsCount)}
              {...autosaveField("consumerComplaintsCount")}
            />
            <FieldError message={errors.consumerComplaintsCount?.message} />
          </div>
          <div>
            <Label htmlFor="consumerComplaintsResolvedPct">Complaints resolved (%)</Label>
            <Input
              id="consumerComplaintsResolvedPct"
              inputMode="decimal"
              error={Boolean(errors.consumerComplaintsResolvedPct)}
              {...autosaveField("consumerComplaintsResolvedPct")}
            />
            <FieldError message={errors.consumerComplaintsResolvedPct?.message} />
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
          placeholder="Anything an assurance provider should know about this disclosure"
          {...autosaveField("notes")}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          {isAlreadySubmitted ? "Resubmit BRSR Core disclosure" : "Submit BRSR Core disclosure"}
        </Button>
      </div>
    </form>
  );
}
