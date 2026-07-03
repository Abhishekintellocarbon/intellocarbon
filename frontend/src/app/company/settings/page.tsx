"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { companySettingsSchema, type CompanySettingsValues } from "@/lib/validations/company";
import { SECTOR_OPTIONS, FY_START_MONTH_OPTIONS } from "@/lib/constants";
import { companyApi, ApiError } from "@/lib/api";

function CompanySettingsContent() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsValues>({ resolver: zodResolver(companySettingsSchema) });

  useEffect(() => {
    companyApi
      .getMine()
      .then(({ company }) => {
        if (!company) {
          setLoadError("Complete company setup before editing settings.");
          return;
        }
        reset({
          name: company.name,
          registrationNumber: company.registrationNumber ?? "",
          address: company.address ?? "",
          city: company.city ?? "",
          state: company.state ?? "",
          pincode: company.pincode ?? "",
          sector: company.sector,
          subSector: company.subSector ?? "",
          annualTurnoverInr: company.annualTurnoverInr ? String(company.annualTurnoverInr) : "",
          employeeCount: company.employeeCount ? String(company.employeeCount) : "",
          reportingFyStartMonth: String(company.reportingFyStartMonth),
          appliesCbam: company.appliesCbam,
          appliesCcts: company.appliesCcts,
          isPatDesignatedConsumer: company.isPatDesignatedConsumer,
          euImporterName: company.euImporterName ?? "",
          euImporterEori: company.euImporterEori ?? "",
          euImporterCountry: company.euImporterCountry ?? "",
          euImporterContactEmail: company.euImporterContactEmail ?? "",
          euImporterContactPhone: company.euImporterContactPhone ?? "",
        });
      })
      .catch(() => setLoadError("Couldn't load your company profile."))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: CompanySettingsValues) => {
    setServerError(null);
    setSaved(false);
    try {
      await companyApi.update({
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
        euImporterName: data.euImporterName || undefined,
        euImporterEori: data.euImporterEori || undefined,
        euImporterCountry: data.euImporterCountry || undefined,
        euImporterContactEmail: data.euImporterContactEmail || undefined,
        euImporterContactPhone: data.euImporterContactPhone || undefined,
      });
      setSaved(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-danger">{loadError}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
          <Building2 className="h-5 w-5 text-[#06120F]" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Company settings</h1>
          <p className="text-sm text-muted-foreground">
            Keep your company profile and EU declarant details up to date for CBAM reporting.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {serverError && <Alert variant="error">{serverError}</Alert>}
        {saved && <Alert variant="success">Company settings saved.</Alert>}

        <Card className="p-6 sm:p-8">
          <h2 className="mb-4 font-medium">Company details</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input id="name" error={Boolean(errors.name)} {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="registrationNumber">
                CIN / registration number <span className="text-muted">(optional)</span>
              </Label>
              <Input id="registrationNumber" {...register("registrationNumber")} />
            </div>
            <div>
              <Label htmlFor="address">
                Registered address <span className="text-muted">(optional)</span>
              </Label>
              <Input id="address" {...register("address")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register("state")} />
              </div>
            </div>
            <div>
              <Label htmlFor="pincode">
                PIN code <span className="text-muted">(optional)</span>
              </Label>
              <Input id="pincode" maxLength={6} {...register("pincode")} />
              <FieldError message={errors.pincode?.message} />
            </div>
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="mb-4 font-medium">Business details</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sector">Primary sector</Label>
              <Select id="sector" error={Boolean(errors.sector)} {...register("sector")}>
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
              <Input id="subSector" {...register("subSector")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="annualTurnoverInr">
                  Annual turnover (INR) <span className="text-muted">(optional)</span>
                </Label>
                <Input id="annualTurnoverInr" type="number" {...register("annualTurnoverInr")} />
              </div>
              <div>
                <Label htmlFor="employeeCount">
                  Employees <span className="text-muted">(optional)</span>
                </Label>
                <Input id="employeeCount" type="number" {...register("employeeCount")} />
              </div>
            </div>
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
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="mb-4 font-medium">Compliance profile</h2>
          <div className="space-y-3">
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
            <Switch
              label="PAT designated consumer"
              description="You're a designated consumer under the Perform, Achieve & Trade scheme"
              {...register("isPatDesignatedConsumer")}
            />
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="mb-1 font-medium">EU declarant details</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The EU-based importer of record who lodges your CBAM declaration. Shown on the Installation and
            Declarant Details page of your CBAM Communication Package.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="euImporterName">
                Importer / EU declarant name <span className="text-muted">(optional)</span>
              </Label>
              <Input id="euImporterName" placeholder="EuroSteel Imports GmbH" {...register("euImporterName")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="euImporterEori">
                  EORI number <span className="text-muted">(optional)</span>
                </Label>
                <Input id="euImporterEori" placeholder="DE1234567890123" {...register("euImporterEori")} />
              </div>
              <div>
                <Label htmlFor="euImporterCountry">
                  Country <span className="text-muted">(optional)</span>
                </Label>
                <Input id="euImporterCountry" placeholder="Germany" {...register("euImporterCountry")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="euImporterContactEmail">
                  Contact email <span className="text-muted">(optional)</span>
                </Label>
                <Input id="euImporterContactEmail" type="email" {...register("euImporterContactEmail")} />
                <FieldError message={errors.euImporterContactEmail?.message} />
              </div>
              <div>
                <Label htmlFor="euImporterContactPhone">
                  Contact phone <span className="text-muted">(optional)</span>
                </Label>
                <Input id="euImporterContactPhone" {...register("euImporterContactPhone")} />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CompanySettingsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <CompanySettingsContent />
        </main>
      </div>
    </ProtectedRoute>
  );
}
