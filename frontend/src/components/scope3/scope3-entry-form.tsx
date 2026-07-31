"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { scope3Api, ApiError } from "@/lib/api";
import type { CalculableScope3Category, Scope3CalculationMethod, Scope3Data } from "@/lib/types";
import {
  METHOD_LABELS,
  MATERIAL_LABELS,
  FREIGHT_LABELS,
  TRAVEL_LABELS,
  COMMUTE_LABELS,
  PRODUCT_TYPE_LABELS,
  FUEL_LABELS,
  emptyFieldsFor,
  fieldsFromInputData,
  schemaFor,
  type FieldsState,
} from "./scope3-field-config";

const optionsFrom = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

function ActivityFields({
  category,
  fields,
  setField,
  errors,
}: {
  category: CalculableScope3Category;
  fields: FieldsState;
  setField: (key: string, value: string) => void;
  errors: Record<string, string>;
}) {
  switch (category) {
    case "CAT1_PURCHASED_GOODS_SERVICES":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="materialType">Material type</Label>
            <Select id="materialType" value={fields.materialType} onChange={(e) => setField("materialType", e.target.value)}>
              {optionsFrom(MATERIAL_LABELS)}
            </Select>
          </div>
          <div>
            <Label htmlFor="quantityKg">Quantity purchased (kg)</Label>
            <Input
              id="quantityKg"
              inputMode="decimal"
              value={fields.quantityKg}
              onChange={(e) => setField("quantityKg", e.target.value)}
              error={Boolean(errors.quantityKg)}
            />
            <FieldError message={errors.quantityKg} />
          </div>
        </div>
      );
    case "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="freightMode">Freight mode</Label>
            <Select id="freightMode" value={fields.freightMode} onChange={(e) => setField("freightMode", e.target.value)}>
              {optionsFrom(FREIGHT_LABELS)}
            </Select>
          </div>
          <div>
            <Label htmlFor="tonnesShipped">Tonnes shipped</Label>
            <Input
              id="tonnesShipped"
              inputMode="decimal"
              value={fields.tonnesShipped}
              onChange={(e) => setField("tonnesShipped", e.target.value)}
              error={Boolean(errors.tonnesShipped)}
            />
            <FieldError message={errors.tonnesShipped} />
          </div>
          <div>
            <Label htmlFor="distanceKm">Distance (km)</Label>
            <Input
              id="distanceKm"
              inputMode="decimal"
              value={fields.distanceKm}
              onChange={(e) => setField("distanceKm", e.target.value)}
              error={Boolean(errors.distanceKm)}
            />
            <FieldError message={errors.distanceKm} />
          </div>
        </div>
      );
    case "CAT6_BUSINESS_TRAVEL":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="travelMode">Travel mode</Label>
            <Select id="travelMode" value={fields.travelMode} onChange={(e) => setField("travelMode", e.target.value)}>
              {optionsFrom(TRAVEL_LABELS)}
            </Select>
          </div>
          <div>
            <Label htmlFor="cat6DistanceKm">Distance per trip (km)</Label>
            <Input
              id="cat6DistanceKm"
              inputMode="decimal"
              value={fields.distanceKm}
              onChange={(e) => setField("distanceKm", e.target.value)}
              error={Boolean(errors.distanceKm)}
            />
            <FieldError message={errors.distanceKm} />
          </div>
          <div>
            <Label htmlFor="numberOfTrips">Number of trips</Label>
            <Input
              id="numberOfTrips"
              inputMode="numeric"
              value={fields.numberOfTrips}
              onChange={(e) => setField("numberOfTrips", e.target.value)}
              error={Boolean(errors.numberOfTrips)}
            />
            <FieldError message={errors.numberOfTrips} />
          </div>
        </div>
      );
    case "CAT7_EMPLOYEE_COMMUTING":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="commuteMode">Commute mode</Label>
            <Select id="commuteMode" value={fields.commuteMode} onChange={(e) => setField("commuteMode", e.target.value)}>
              {optionsFrom(COMMUTE_LABELS)}
            </Select>
          </div>
          <div>
            <Label htmlFor="employeeCount">Employees using this mode</Label>
            <Input
              id="employeeCount"
              inputMode="numeric"
              value={fields.employeeCount}
              onChange={(e) => setField("employeeCount", e.target.value)}
              error={Boolean(errors.employeeCount)}
            />
            <FieldError message={errors.employeeCount} />
          </div>
          <div>
            <Label htmlFor="oneWayDistanceKm">One-way commute distance (km)</Label>
            <Input
              id="oneWayDistanceKm"
              inputMode="decimal"
              value={fields.oneWayDistanceKm}
              onChange={(e) => setField("oneWayDistanceKm", e.target.value)}
              error={Boolean(errors.oneWayDistanceKm)}
            />
            <FieldError message={errors.oneWayDistanceKm} />
          </div>
          <div>
            <Label htmlFor="commutingDaysPerYear">Commuting days per year</Label>
            <Input
              id="commutingDaysPerYear"
              inputMode="numeric"
              value={fields.commutingDaysPerYear}
              onChange={(e) => setField("commutingDaysPerYear", e.target.value)}
              error={Boolean(errors.commutingDaysPerYear)}
            />
            <FieldError message={errors.commutingDaysPerYear} />
          </div>
        </div>
      );
    case "CAT11_USE_OF_SOLD_PRODUCTS":
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="productType">Product type</Label>
            <Select id="productType" value={fields.productType} onChange={(e) => setField("productType", e.target.value)}>
              {optionsFrom(PRODUCT_TYPE_LABELS)}
            </Select>
          </div>
          <div>
            <Label htmlFor="unitsSold">Units sold this period</Label>
            <Input
              id="unitsSold"
              inputMode="numeric"
              value={fields.unitsSold}
              onChange={(e) => setField("unitsSold", e.target.value)}
              error={Boolean(errors.unitsSold)}
            />
            <FieldError message={errors.unitsSold} />
          </div>
          {fields.productType === "ELECTRICITY_CONSUMING" ? (
            <div>
              <Label htmlFor="lifetimeEnergyConsumptionKwh">Lifetime energy use per unit (kWh)</Label>
              <Input
                id="lifetimeEnergyConsumptionKwh"
                inputMode="decimal"
                value={fields.lifetimeEnergyConsumptionKwh}
                onChange={(e) => setField("lifetimeEnergyConsumptionKwh", e.target.value)}
                error={Boolean(errors.lifetimeEnergyConsumptionKwh)}
              />
              <FieldError message={errors.lifetimeEnergyConsumptionKwh} />
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="fuelType">Fuel type</Label>
                <Select id="fuelType" value={fields.fuelType} onChange={(e) => setField("fuelType", e.target.value)}>
                  <option value="">Select...</option>
                  {optionsFrom(FUEL_LABELS)}
                </Select>
                <FieldError message={errors.fuelType} />
              </div>
              <div>
                <Label htmlFor="lifetimeFuelConsumptionLitres">Lifetime fuel use per unit (litres)</Label>
                <Input
                  id="lifetimeFuelConsumptionLitres"
                  inputMode="decimal"
                  value={fields.lifetimeFuelConsumptionLitres}
                  onChange={(e) => setField("lifetimeFuelConsumptionLitres", e.target.value)}
                  error={Boolean(errors.lifetimeFuelConsumptionLitres)}
                />
                <FieldError message={errors.lifetimeFuelConsumptionLitres} />
              </div>
            </>
          )}
        </div>
      );
  }
}

export function Scope3EntryForm({
  facilityId,
  reportingPeriod,
  category,
  existingEntry,
  onSaved,
  onDeleted,
  onCancel,
}: {
  facilityId: string;
  reportingPeriod: string;
  category: CalculableScope3Category;
  existingEntry?: Scope3Data;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<Scope3CalculationMethod>(existingEntry?.calculationMethod ?? "SPEND_BASED");
  const [fields, setFields] = useState<FieldsState>(
    existingEntry ? fieldsFromInputData(method, category, existingEntry.inputData) : emptyFieldsFor(method, category),
  );
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ tco2e: number; source: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const isAlreadySubmitted = existingEntry?.status === "SUBMITTED";

  const switchMethod = (next: Scope3CalculationMethod) => {
    setMethod(next);
    setFields(emptyFieldsFor(next, category));
    setErrors({});
    setPreview(null);
  };

  const setField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setPreview(null);
  };

  const validate = (): Record<string, unknown> | null => {
    const schema = schemaFor(method, category);
    const result = schema.safeParse(fields);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return result.data as Record<string, unknown>;
  };

  const save = async (submit: boolean) => {
    setServerError(null);
    const inputData = validate();
    if (!inputData) return;

    setSaving(true);
    try {
      const { entry } = await scope3Api.save(
        facilityId,
        { reportingPeriod, category, calculationMethod: method, inputData, notes: notes || undefined },
        submit,
      );
      setPreview({ tco2e: entry.calculatedEmissionsTco2e, source: entry.emissionFactorSource });
      onSaved();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    setSaving(true);
    try {
      await scope3Api.remove(facilityId, reportingPeriod, category);
      onDeleted();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't remove this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-surface-border pt-4">
      {serverError && <Alert variant="error">{serverError}</Alert>}
      {isAlreadySubmitted && (
        <Alert variant="info">This entry has already been submitted. Resubmit explicitly below to change it.</Alert>
      )}

      <div>
        <Label htmlFor="calculationMethod">Calculation method</Label>
        <Select
          id="calculationMethod"
          value={method}
          onChange={(e) => switchMethod(e.target.value as Scope3CalculationMethod)}
        >
          <option value="SPEND_BASED">{METHOD_LABELS.SPEND_BASED}</option>
          <option value="ACTIVITY_BASED">{METHOD_LABELS.ACTIVITY_BASED}</option>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose activity-based where you have physical activity data — it&apos;s more accurate. Spend-based is a faster
          screening estimate from what you spent.
        </p>
      </div>

      {method === "SPEND_BASED" ? (
        <div className="max-w-xs">
          <Label htmlFor="spendInr">Amount spent (₹)</Label>
          <Input
            id="spendInr"
            inputMode="decimal"
            value={fields.spendInr}
            onChange={(e) => setField("spendInr", e.target.value)}
            error={Boolean(errors.spendInr)}
          />
          <FieldError message={errors.spendInr} />
        </div>
      ) : (
        <ActivityFields category={category} fields={fields} setField={setField} errors={errors} />
      )}

      {preview && (
        <Alert variant="success">
          <span className="font-semibold">{preview.tco2e} tCO2e</span> — {preview.source}
        </Alert>
      )}

      <div>
        <Label htmlFor={`notes-${category}`}>
          Notes <span className="text-muted">(optional)</span>
        </Label>
        <Input id={`notes-${category}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {existingEntry && (
            <Button type="button" variant="danger" size="sm" onClick={handleDelete} isLoading={saving}>
              Remove
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => save(false)} isLoading={saving}>
            Save draft
          </Button>
          <Button type="button" size="sm" onClick={() => save(true)} isLoading={saving}>
            {isAlreadySubmitted ? "Resubmit" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
