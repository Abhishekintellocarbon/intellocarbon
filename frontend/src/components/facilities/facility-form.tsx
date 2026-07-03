"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { facilitySchema, type FacilityFormValues } from "@/lib/validations/facility";
import { FACILITY_TYPE_OPTIONS, PRODUCTION_ROUTE_OPTIONS } from "@/lib/constants";
import { facilityApi, ApiError } from "@/lib/api";
import type { Facility } from "@/lib/types";

export function FacilityForm({ facility }: { facility?: Facility }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";
  const isEditing = Boolean(facility);

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: facility
      ? {
          name: facility.name,
          facilityType: facility.facilityType,
          productionRoute: facility.productionRoute,
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

  const onSubmit = async (data: FacilityFormValues) => {
    setServerError(null);
    try {
      const payload = {
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
        cnCodes: data.cnCodes
          ? data.cnCodes.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
      };

      const result = facility
        ? await facilityApi.update(facility.id, payload)
        : await facilityApi.create(payload);
      router.push(`/facilities/${result.facility.id}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
          <Factory className="h-5 w-5 text-[#06120F]" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">
            {isEditing ? "Edit facility" : isOnboarding ? "Add your first facility" : "Add a facility"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? "Update facility details, including data used on your CBAM reports."
              : isOnboarding
                ? "One more step — tell us about the plant you want to track."
                : "Facilities are where activity data and emissions are tracked."}
          </p>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <div>
            <Label htmlFor="name">Facility name</Label>
            <Input id="name" placeholder="Jamshedpur Plant 1" error={Boolean(errors.name)} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="facilityType">Facility type</Label>
              <Select id="facilityType" error={Boolean(errors.facilityType)} {...register("facilityType")}>
                <option value="">Select type</option>
                {FACILITY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.facilityType?.message} />
            </div>
            <div>
              <Label htmlFor="productionRoute">Production route</Label>
              <Select id="productionRoute" error={Boolean(errors.productionRoute)} {...register("productionRoute")}>
                <option value="">Select route</option>
                {PRODUCTION_ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.productionRoute?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor="address">
              Address <span className="text-muted">(optional)</span>
            </Label>
            <Input id="address" placeholder="Plot 4, Steel City Industrial Estate" {...register("address")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="Jharkhand" {...register("state")} />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input id="district" placeholder="East Singhbhum" {...register("district")} />
            </div>
            <div>
              <Label htmlFor="pincode">PIN code</Label>
              <Input id="pincode" placeholder="831001" maxLength={6} {...register("pincode")} />
              <FieldError message={errors.pincode?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">
                GPS latitude <span className="text-muted">(optional)</span>
              </Label>
              <Input id="latitude" type="number" step="any" placeholder="22.8046" {...register("latitude")} />
            </div>
            <div>
              <Label htmlFor="longitude">
                GPS longitude <span className="text-muted">(optional)</span>
              </Label>
              <Input id="longitude" type="number" step="any" placeholder="86.2029" {...register("longitude")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="installedCapacityTpa">
                Installed capacity (tonnes/year) <span className="text-muted">(optional)</span>
              </Label>
              <Input id="installedCapacityTpa" type="number" placeholder="2000000" {...register("installedCapacityTpa")} />
            </div>
            <div>
              <Label htmlFor="commissioningYear">
                Commissioning year <span className="text-muted">(optional)</span>
              </Label>
              <Input id="commissioningYear" type="number" placeholder="1998" {...register("commissioningYear")} />
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
              {...register("productsManufactured")}
            />
          </div>

          <div>
            <Label htmlFor="cnCodes">
              CN code(s) <span className="text-muted">(comma-separated, optional)</span>
            </Label>
            <Input id="cnCodes" placeholder="7208 10, 7208 25" {...register("cnCodes")} />
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
