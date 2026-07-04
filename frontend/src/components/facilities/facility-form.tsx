"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type UseFormRegisterReturn, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Factory, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import { facilitySchema, type FacilityFormValues } from "@/lib/validations/facility";
import { FACILITY_TYPE_OPTIONS, SECTOR_FACILITY_TYPE_VALUES } from "@/lib/constants";
import { facilityApi, companyApi, referenceApi, ApiError } from "@/lib/api";
import type { Facility, ReferenceOption, Sector } from "@/lib/types";

export function FacilityForm({ facility }: { facility?: Facility }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";
  const isEditing = Boolean(facility);
  // Autosave only applies to the setup wizard (a brand-new facility, or
  // resuming an incomplete one). Editing an already-complete facility keeps
  // its existing plain strict-update behavior untouched.
  const isDraftMode = !facility || facility.isDraft;

  const [serverError, setServerError] = useState<string | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [routeOptions, setRouteOptions] = useState<ReferenceOption[]>([]);
  const savedFacilityId = useRef<string | undefined>(facility?.id);

  useEffect(() => {
    Promise.all([companyApi.getMine(), referenceApi.emissionFactors()])
      .then(([{ company }, reference]) => {
        if (!company) return;
        setSector(company.sector);
        setRouteOptions(reference.sectorProductionRoutes[company.sector] ?? []);
      })
      .catch(() => setServerError("Couldn't load your company's sector. Please try again."));
  }, []);

  const facilityTypeOptions = sector
    ? FACILITY_TYPE_OPTIONS.filter((o) => SECTOR_FACILITY_TYPE_VALUES[sector].includes(o.value))
    : FACILITY_TYPE_OPTIONS;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: facility
      ? {
          name: facility.name,
          // A draft facility may not have this set yet — cast past the
          // strict enum type since "" (the unselected <option>) is a valid
          // runtime value here; zodResolver still requires a real value at
          // submit time.
          facilityType: (facility.facilityType ?? "") as FacilityFormValues["facilityType"],
          productionRoute: facility.productionRoute ?? "",
          address: facility.address ?? "",
          state: facility.state ?? "",
          district: facility.district ?? "",
          pincode: facility.pincode ?? "",
          latitude: facility.latitude != null ? String(facility.latitude) : "",
          longitude: facility.longitude != null ? String(facility.longitude) : "",
          installedCapacityTpa: facility.installedCapacityTpa != null ? String(facility.installedCapacityTpa) : "",
          commissioningYear: facility.commissioningYear != null ? String(facility.commissioningYear) : "",
          productsManufactured: facility.productsManufactured.join(", "),
          cnCodes: facility.cnCodes.join(", "),
        }
      : undefined,
  });

  const buildPayload = (data: Partial<FacilityFormValues>) => ({
    ...data,
    address: data.address || undefined,
    state: data.state || undefined,
    district: data.district || undefined,
    pincode: data.pincode || undefined,
    latitude: data.latitude ? Number(data.latitude) : undefined,
    longitude: data.longitude ? Number(data.longitude) : undefined,
    installedCapacityTpa: data.installedCapacityTpa ? Number(data.installedCapacityTpa) : undefined,
    commissioningYear: data.commissioningYear ? Number(data.commissioningYear) : undefined,
    productsManufactured: data.productsManufactured
      ? data.productsManufactured.split(",").map((p) => p.trim()).filter(Boolean)
      : [],
    cnCodes: data.cnCodes ? data.cnCodes.split(",").map((c) => c.trim()).filter(Boolean) : [],
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    const payload = buildPayload(getValues());
    if (!savedFacilityId.current) {
      const { facility: created } = await facilityApi.autosaveNew(payload);
      savedFacilityId.current = created.id;
    } else {
      await facilityApi.autosave(savedFacilityId.current, payload);
    }
  });

  // Drop-in replacement for `register(name)` that also triggers a debounced
  // autosave on blur — skipped entirely outside draft mode.
  const autosaveField = (name: Path<FacilityFormValues>): UseFormRegisterReturn => {
    const field = register(name);
    if (!isDraftMode) return field;
    return {
      ...field,
      onBlur: (e) => {
        const result = field.onBlur(e);
        triggerAutosave();
        return result;
      },
    };
  };

  const onSubmit = async (data: FacilityFormValues) => {
    setServerError(null);
    try {
      const payload = buildPayload(data);

      const result = !isDraftMode
        ? await facilityApi.update(facility!.id, payload)
        : savedFacilityId.current
          ? await facilityApi.complete(savedFacilityId.current, payload)
          : await facilityApi.create(payload);
      router.push(`/facilities/${result.facility.id}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <Factory className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing && !isDraftMode
                ? "Edit facility"
                : isOnboarding
                  ? "Add your first facility"
                  : "Add a facility"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing && !isDraftMode
                ? "Update facility details, including data used on your CBAM reports."
                : isOnboarding
                  ? "One more step — tell us about the plant you want to track."
                  : "Facilities are where activity data and emissions are tracked."}
            </p>
          </div>
        </div>
        {isDraftMode && <AutosaveIndicator status={autosaveStatus} />}
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <div>
            <Label htmlFor="name">Facility name</Label>
            <Input id="name" placeholder="Jamshedpur Plant 1" error={Boolean(errors.name)} {...autosaveField("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="facilityType">Facility type</Label>
              <Select id="facilityType" error={Boolean(errors.facilityType)} {...autosaveField("facilityType")}>
                <option value="">Select type</option>
                {facilityTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.facilityType?.message} />
            </div>
            <div>
              <Label htmlFor="productionRoute">Production route</Label>
              <Select id="productionRoute" error={Boolean(errors.productionRoute)} {...autosaveField("productionRoute")}>
                <option value="">Select route</option>
                {routeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.productionRoute?.message} />
              {sector === null && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading routes for your sector...
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="address">
              Address <span className="text-muted">(optional)</span>
            </Label>
            <Input id="address" placeholder="Plot 4, Steel City Industrial Estate" {...autosaveField("address")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="Jharkhand" {...autosaveField("state")} />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input id="district" placeholder="East Singhbhum" {...autosaveField("district")} />
            </div>
            <div>
              <Label htmlFor="pincode">PIN code</Label>
              <Input id="pincode" placeholder="831001" maxLength={6} {...autosaveField("pincode")} />
              <FieldError message={errors.pincode?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">
                GPS latitude <span className="text-muted">(optional)</span>
              </Label>
              <Input id="latitude" type="number" step="any" placeholder="22.8046" {...autosaveField("latitude")} />
            </div>
            <div>
              <Label htmlFor="longitude">
                GPS longitude <span className="text-muted">(optional)</span>
              </Label>
              <Input id="longitude" type="number" step="any" placeholder="86.2029" {...autosaveField("longitude")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="installedCapacityTpa">
                Installed capacity (tonnes/year) <span className="text-muted">(optional)</span>
              </Label>
              <Input id="installedCapacityTpa" type="number" placeholder="2000000" {...autosaveField("installedCapacityTpa")} />
            </div>
            <div>
              <Label htmlFor="commissioningYear">
                Commissioning year <span className="text-muted">(optional)</span>
              </Label>
              <Input id="commissioningYear" type="number" placeholder="1998" {...autosaveField("commissioningYear")} />
              <FieldError message={errors.commissioningYear?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor="productsManufactured">
              Products manufactured <span className="text-muted">(comma-separated, optional)</span>
            </Label>
            <Input
              id="productsManufactured"
              placeholder="Crude Steel, Hot Rolled Coil"
              {...autosaveField("productsManufactured")}
            />
          </div>

          <div>
            <Label htmlFor="cnCodes">
              CN code(s) <span className="text-muted">(comma-separated, optional)</span>
            </Label>
            <Input id="cnCodes" placeholder="7208 10, 7208 25" {...autosaveField("cnCodes")} />
            <p className="mt-1 text-xs text-muted-foreground">
              Customs (CN) codes for goods produced here — shown on your CBAM report.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? "Save changes" : isOnboarding ? "Finish setup" : "Add facility"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
