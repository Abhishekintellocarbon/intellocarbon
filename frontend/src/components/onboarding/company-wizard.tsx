"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { WizardProgress } from "./wizard-progress";
import { companyWizardSchema, companyStepFields, type CompanyWizardValues } from "@/lib/validations/company";
import { SECTOR_OPTIONS, FY_START_MONTH_OPTIONS } from "@/lib/constants";
import { companyApi, ApiError } from "@/lib/api";

const STEPS = ["Company basics", "Business details", "Compliance profile", "Review & confirm"];

export function CompanyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<CompanyWizardValues>({
    resolver: zodResolver(companyWizardSchema),
    defaultValues: {
      reportingFyStartMonth: "4",
      appliesCbam: false,
      appliesCcts: false,
      isPatDesignatedConsumer: false,
    },
  });

  const values = watch();

  const goNext = async () => {
    const fields = companyStepFields[step];
    const valid = await trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (data: CompanyWizardValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await companyApi.create({
        ...data,
        registrationNumber: data.registrationNumber || undefined,
        subSector: data.subSector || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        pincode: data.pincode || undefined,
        annualTurnoverInr: data.annualTurnoverInr ? Number(data.annualTurnoverInr) : undefined,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
        reportingFyStartMonth: Number(data.reportingFyStartMonth),
      });
      router.push("/billing?onboarding=1");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const sectorLabel = SECTOR_OPTIONS.find((s) => s.value === values.sector)?.label;
  const fyLabel = FY_START_MONTH_OPTIONS.find((m) => m.value === values.reportingFyStartMonth)?.label;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
          <Building2 className="h-5 w-5 text-[#06120F]" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Set up your company</h1>
          <p className="text-sm text-muted-foreground">
            This powers your compliance profile and emissions calculations.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <WizardProgress steps={STEPS} currentStep={step} />
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div className="mb-5">
              <Alert variant="error">{serverError}</Alert>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in space-y-4">
              <div>
                <Label htmlFor="name">Company name</Label>
                <Input id="name" placeholder="Bharat Steel Works Pvt. Ltd." error={Boolean(errors.name)} {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="registrationNumber">
                  CIN / registration number <span className="text-muted">(optional)</span>
                </Label>
                <Input id="registrationNumber" placeholder="U27310MH2001PTC123456" {...register("registrationNumber")} />
              </div>
              <div>
                <Label htmlFor="address">
                  Registered address <span className="text-muted">(optional)</span>
                </Label>
                <Input id="address" placeholder="Plot 12, Industrial Area" {...register("address")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Jamshedpur" {...register("city")} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="Jharkhand" {...register("state")} />
                </div>
              </div>
              <div>
                <Label htmlFor="pincode">
                  PIN code <span className="text-muted">(optional)</span>
                </Label>
                <Input id="pincode" placeholder="831001" maxLength={6} {...register("pincode")} />
                <FieldError message={errors.pincode?.message} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in space-y-4">
              <div>
                <Label htmlFor="sector">Primary sector</Label>
                <Select id="sector" error={Boolean(errors.sector)} {...register("sector")}>
                  <option value="">Select a sector</option>
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.sector?.message} />
              </div>
              <div>
                <Label htmlFor="subSector">
                  Sub-sector / description <span className="text-muted">(optional)</span>
                </Label>
                <Input id="subSector" placeholder="Integrated steel plant" {...register("subSector")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="annualTurnoverInr">
                    Annual turnover (INR) <span className="text-muted">(optional)</span>
                  </Label>
                  <Input id="annualTurnoverInr" type="number" placeholder="5000000000" {...register("annualTurnoverInr")} />
                </div>
                <div>
                  <Label htmlFor="employeeCount">
                    Employees <span className="text-muted">(optional)</span>
                  </Label>
                  <Input id="employeeCount" type="number" placeholder="1200" {...register("employeeCount")} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in space-y-4">
              <div>
                <Label htmlFor="reportingFyStartMonth">Reporting financial year starts</Label>
                <Select id="reportingFyStartMonth" {...register("reportingFyStartMonth")}>
                  {FY_START_MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted">
                Applicable regulations
              </p>
              <Switch
                label="EU CBAM"
                description="You export CBAM goods (e.g. iron & steel) into the EU"
                {...register("appliesCbam")}
              />
              <Switch
                label="India CCTS"
                description="You're an obligated entity under India's Carbon Credit Trading Scheme"
                {...register("appliesCcts")}
              />
              {/* PAT toggle removed from UI — out of current product scope. Field
                  stays in defaultValues/schema so it still submits (as false) and
                  round-trips; not deleted from the schema or backend. */}
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in space-y-5">
              <ReviewRow label="Company">{values.name}</ReviewRow>
              {values.registrationNumber && <ReviewRow label="Registration no.">{values.registrationNumber}</ReviewRow>}
              <ReviewRow label="Location">
                {[values.city, values.state, values.pincode].filter(Boolean).join(", ") || "—"}
              </ReviewRow>
              <ReviewRow label="Sector">{sectorLabel}{values.subSector ? ` — ${values.subSector}` : ""}</ReviewRow>
              {(values.annualTurnoverInr || values.employeeCount) && (
                <ReviewRow label="Scale">
                  {values.annualTurnoverInr ? `₹${Number(values.annualTurnoverInr).toLocaleString("en-IN")}` : ""}
                  {values.annualTurnoverInr && values.employeeCount ? " · " : ""}
                  {values.employeeCount ? `${values.employeeCount} employees` : ""}
                </ReviewRow>
              )}
              <ReviewRow label="Reporting FY">{fyLabel}</ReviewRow>
              <ReviewRow label="Applicable schemes">
                {[values.appliesCbam && "EU CBAM", values.appliesCcts && "India CCTS"]
                  .filter(Boolean)
                  .join(", ") || "None selected"}
              </ReviewRow>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}

            {step < STEPS.length ? (
              <Button key="continue" type="button" onClick={goNext}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button key="submit" type="submit" isLoading={isSubmitting}>
                {isSubmitting ? "Saving..." : "Complete setup"}
                {!isSubmitting && <Check className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{children || "—"}</span>
    </div>
  );
}
