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
import { issbS1S2Schema, type IssbS1S2FormValues } from "@/lib/validations/issb";
import { issbApi, ApiError } from "@/lib/api";
import type { IssbS1S2Report } from "@/lib/types";
import { Scope3Section } from "@/components/scope3/scope3-section";

const toStr = (v: number | null | undefined) => (v != null ? String(v) : "");

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

export function IssbS1S2Form({
  facilityId,
  reportingPeriod,
  existingReport,
}: {
  facilityId: string;
  reportingPeriod: string;
  existingReport?: IssbS1S2Report;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Autosave is only safe while the report is still a draft — the backend
  // rejects a non-submit save once it's SUBMITTED (resubmission must be
  // explicit), matching BRSR Core's guard.
  const isAlreadySubmitted = existingReport?.status === "SUBMITTED";

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<IssbS1S2FormValues>({
    resolver: zodResolver(issbS1S2Schema),
    defaultValues: {
      reportingPeriod,
      governanceBodyOversight: existingReport?.governanceBodyOversight ?? "",
      managementRole: existingReport?.managementRole ?? "",
      climateRisksOpportunities: existingReport?.climateRisksOpportunities ?? "",
      businessModelImpact: existingReport?.businessModelImpact ?? "",
      financialEffects: existingReport?.financialEffects ?? "",
      scenarioAnalysisResilience: existingReport?.scenarioAnalysisResilience ?? "",
      riskIdentificationProcess: existingReport?.riskIdentificationProcess ?? "",
      riskManagementProcess: existingReport?.riskManagementProcess ?? "",
      riskIntegrationOverall: existingReport?.riskIntegrationOverall ?? "",
      scope3Tco2e: toStr(existingReport?.scope3Tco2e),
      targetDescription: existingReport?.targetDescription ?? "",
      targetYear: toStr(existingReport?.targetYear),
      baselineYear: toStr(existingReport?.baselineYear),
      baselineEmissionsTco2e: toStr(existingReport?.baselineEmissionsTco2e),
      transitionPlan: existingReport?.transitionPlan ?? "",
      internalCarbonPriceInr: toStr(existingReport?.internalCarbonPriceInr),
      climateCapexInr: toStr(existingReport?.climateCapexInr),
      notes: existingReport?.notes ?? "",
    },
  });

  const buildPayload = (data: Partial<IssbS1S2FormValues>) => ({
    reportingPeriod,
    governanceBodyOversight: data.governanceBodyOversight || undefined,
    managementRole: data.managementRole || undefined,
    climateRisksOpportunities: data.climateRisksOpportunities || undefined,
    businessModelImpact: data.businessModelImpact || undefined,
    financialEffects: data.financialEffects || undefined,
    scenarioAnalysisResilience: data.scenarioAnalysisResilience || undefined,
    riskIdentificationProcess: data.riskIdentificationProcess || undefined,
    riskManagementProcess: data.riskManagementProcess || undefined,
    riskIntegrationOverall: data.riskIntegrationOverall || undefined,
    scope3Tco2e: data.scope3Tco2e || undefined,
    targetDescription: data.targetDescription || undefined,
    targetYear: data.targetYear || undefined,
    baselineYear: data.baselineYear || undefined,
    baselineEmissionsTco2e: data.baselineEmissionsTco2e || undefined,
    transitionPlan: data.transitionPlan || undefined,
    internalCarbonPriceInr: data.internalCarbonPriceInr || undefined,
    climateCapexInr: data.climateCapexInr || undefined,
    notes: data.notes || undefined,
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    await issbApi.save(facilityId, buildPayload(getValues()), false);
  });

  const autosaveField = (name: Path<IssbS1S2FormValues>): UseFormRegisterReturn => {
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

  const onSubmit = async (data: IssbS1S2FormValues) => {
    setServerError(null);
    try {
      await issbApi.save(facilityId, buildPayload(data), true);
      router.push(`/facilities/${facilityId}/issb/${encodeURIComponent(reportingPeriod)}`);
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
        <h2 className="font-medium">Governance</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          IFRS S1 §27-28 / IFRS S2 §6 — oversight of sustainability- and climate-related risks and opportunities.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="governanceBodyOversight">Oversight by the governance body</Label>
            <textarea
              id="governanceBodyOversight"
              rows={3}
              className={textareaClass}
              placeholder="How the board/governance body oversees sustainability-related risks and opportunities"
              {...autosaveField("governanceBodyOversight")}
            />
            <FieldError message={errors.governanceBodyOversight?.message} />
          </div>
          <div>
            <Label htmlFor="managementRole">Management&apos;s role</Label>
            <textarea
              id="managementRole"
              rows={3}
              className={textareaClass}
              placeholder="Management's role in assessing and managing sustainability-related risks and opportunities"
              {...autosaveField("managementRole")}
            />
            <FieldError message={errors.managementRole?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Strategy</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          IFRS S1 §29-42 / IFRS S2 §9-22 — effects on business model, strategy, and financial planning.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="climateRisksOpportunities">Climate-related risks and opportunities</Label>
            <textarea
              id="climateRisksOpportunities"
              rows={3}
              className={textareaClass}
              placeholder="Physical and transition risks, and climate-related opportunities identified"
              {...autosaveField("climateRisksOpportunities")}
            />
            <FieldError message={errors.climateRisksOpportunities?.message} />
          </div>
          <div>
            <Label htmlFor="businessModelImpact">Effect on business model and value chain</Label>
            <textarea
              id="businessModelImpact"
              rows={3}
              className={textareaClass}
              {...autosaveField("businessModelImpact")}
            />
            <FieldError message={errors.businessModelImpact?.message} />
          </div>
          <div>
            <Label htmlFor="financialEffects">Effect on financial position, performance and cash flows</Label>
            <textarea id="financialEffects" rows={3} className={textareaClass} {...autosaveField("financialEffects")} />
            <FieldError message={errors.financialEffects?.message} />
          </div>
          <div>
            <Label htmlFor="scenarioAnalysisResilience">Climate resilience — scenario analysis</Label>
            <textarea
              id="scenarioAnalysisResilience"
              rows={3}
              className={textareaClass}
              {...autosaveField("scenarioAnalysisResilience")}
            />
            <FieldError message={errors.scenarioAnalysisResilience?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Risk Management</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          IFRS S1 §43-45 / IFRS S2 §25-27 — processes to identify, assess and manage risks.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="riskIdentificationProcess">Risk identification and assessment process</Label>
            <textarea
              id="riskIdentificationProcess"
              rows={3}
              className={textareaClass}
              {...autosaveField("riskIdentificationProcess")}
            />
            <FieldError message={errors.riskIdentificationProcess?.message} />
          </div>
          <div>
            <Label htmlFor="riskManagementProcess">Risk management and prioritisation process</Label>
            <textarea
              id="riskManagementProcess"
              rows={3}
              className={textareaClass}
              {...autosaveField("riskManagementProcess")}
            />
            <FieldError message={errors.riskManagementProcess?.message} />
          </div>
          <div>
            <Label htmlFor="riskIntegrationOverall">Integration into overall risk management</Label>
            <textarea
              id="riskIntegrationOverall"
              rows={3}
              className={textareaClass}
              {...autosaveField("riskIntegrationOverall")}
            />
            <FieldError message={errors.riskIntegrationOverall?.message} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Metrics & Targets</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Scope 1 and Scope 2 are reused automatically from this facility&apos;s activity data (AR5 basis). Scope 3 and
          targets are manual disclosures.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="scope3Tco2e">Scope 3 emissions (tCO2e)</Label>
            <Input id="scope3Tco2e" inputMode="decimal" error={Boolean(errors.scope3Tco2e)} {...autosaveField("scope3Tco2e")} />
            <FieldError message={errors.scope3Tco2e?.message} />
          </div>
          <div>
            <Label htmlFor="baselineYear">Baseline year</Label>
            <Input id="baselineYear" inputMode="numeric" error={Boolean(errors.baselineYear)} {...autosaveField("baselineYear")} />
            <FieldError message={errors.baselineYear?.message} />
          </div>
          <div>
            <Label htmlFor="baselineEmissionsTco2e">Baseline emissions (tCO2e)</Label>
            <Input
              id="baselineEmissionsTco2e"
              inputMode="decimal"
              error={Boolean(errors.baselineEmissionsTco2e)}
              {...autosaveField("baselineEmissionsTco2e")}
            />
            <FieldError message={errors.baselineEmissionsTco2e?.message} />
          </div>
          <div>
            <Label htmlFor="targetYear">Target year</Label>
            <Input id="targetYear" inputMode="numeric" error={Boolean(errors.targetYear)} {...autosaveField("targetYear")} />
            <FieldError message={errors.targetYear?.message} />
          </div>
          <div>
            <Label htmlFor="internalCarbonPriceInr">Internal carbon price (Rs./tCO2e)</Label>
            <Input
              id="internalCarbonPriceInr"
              inputMode="decimal"
              error={Boolean(errors.internalCarbonPriceInr)}
              {...autosaveField("internalCarbonPriceInr")}
            />
            <FieldError message={errors.internalCarbonPriceInr?.message} />
          </div>
          <div>
            <Label htmlFor="climateCapexInr">Climate-aligned capital expenditure (Rs.)</Label>
            <Input
              id="climateCapexInr"
              inputMode="decimal"
              error={Boolean(errors.climateCapexInr)}
              {...autosaveField("climateCapexInr")}
            />
            <FieldError message={errors.climateCapexInr?.message} />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="targetDescription">Target description</Label>
            <textarea
              id="targetDescription"
              rows={3}
              className={textareaClass}
              placeholder="Emissions reduction or other climate-related target and how it was set"
              {...autosaveField("targetDescription")}
            />
            <FieldError message={errors.targetDescription?.message} />
          </div>
          <div>
            <Label htmlFor="transitionPlan">Transition plan</Label>
            <textarea
              id="transitionPlan"
              rows={3}
              className={textareaClass}
              placeholder="Plan to achieve climate-related targets and transition to a lower-carbon economy"
              {...autosaveField("transitionPlan")}
            />
            <FieldError message={errors.transitionPlan?.message} />
          </div>
        </div>
      </Card>

      <Scope3Section facilityId={facilityId} reportingPeriod={reportingPeriod} />

      <Card className="p-6">
        <Label htmlFor="notes">
          Notes <span className="text-muted">(optional)</span>
        </Label>
        <textarea
          id="notes"
          rows={3}
          className={textareaClass}
          placeholder="Anything an assurance provider or investor should know about this disclosure"
          {...autosaveField("notes")}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          {isAlreadySubmitted ? "Resubmit ISSB disclosure" : "Submit ISSB disclosure"}
        </Button>
      </div>
    </form>
  );
}
