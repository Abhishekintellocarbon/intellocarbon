"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { adminApi, ApiError } from "@/lib/api";
import type { EmissionFactor } from "@/lib/types";

const CONFIRM_MESSAGE =
  "This will affect all future calculations using this factor. Historical calculations already performed are not affected. Continue?";

const EU_CBAM_PRICE_PAGE_URL =
  "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// -----------------------------------------------------------------------
// Quick-update card — CBAM certificate price / CEA grid emission factor
// -----------------------------------------------------------------------

function QuickUpdateCard({
  title,
  unit,
  valuePrefix,
  current,
  linkHref,
  linkLabel,
  onSave,
}: {
  title: string;
  unit: string;
  valuePrefix?: string;
  current: EmissionFactor | undefined;
  linkHref?: string;
  linkLabel?: string;
  onSave: (value: number, source: string) => Promise<void>;
}) {
  const [value, setValue] = useState(current ? String(current.value) : "");
  const [source, setSource] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(current ? String(current.value) : "");
  }, [current]);

  const handleSave = async () => {
    const numericValue = Number(value);
    if (!value || Number.isNaN(numericValue) || numericValue <= 0) {
      setError("Enter a positive value.");
      return;
    }
    if (source.trim().length < 5) {
      setError("Cite the regulation and annex this value comes from.");
      return;
    }
    if (!window.confirm(CONFIRM_MESSAGE)) return;

    setError(null);
    setIsSaving(true);
    try {
      await onSave(numericValue, source.trim());
      setSource("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this value.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-2xl font-semibold text-foreground">
        {current ? `${valuePrefix ?? ""}${current.value.toLocaleString("en-IN", { maximumFractionDigits: 3 })}` : "—"}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Last updated {fmtDate(current?.validFrom ?? null)}
        {linkHref && (
          <>
            {" · "}
            <Link href={linkHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-500 hover:text-teal-400">
              {linkLabel}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </>
        )}
      </p>

      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor={`${title}-value`}>New value</Label>
          <Input id={`${title}-value`} type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${title}-source`}>Source citation</Label>
          <Input
            id={`${title}-source`}
            placeholder="Regulation / annex this value comes from"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={handleSave} isLoading={isSaving} disabled={!value || !source}>
          Save
        </Button>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Shared modal chrome
// -----------------------------------------------------------------------

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <Card className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {children}
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------
// Edit modal — updates the value only, always via /supersede so history
// is preserved rather than overwritten.
// -----------------------------------------------------------------------

function EditFactorModal({
  factor,
  onClose,
  onSaved,
}: {
  factor: EmissionFactor;
  onClose: () => void;
  onSaved: (updated: EmissionFactor) => void;
}) {
  const [value, setValue] = useState(String(factor.value));
  const [source, setSource] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const numericValue = Number(value);
    if (value === "" || Number.isNaN(numericValue)) {
      setError("Enter a numeric value.");
      return;
    }
    if (source.trim().length < 5) {
      setError("Cite the regulation and annex this value comes from.");
      return;
    }
    if (!window.confirm(CONFIRM_MESSAGE)) return;

    setError(null);
    setIsSaving(true);
    try {
      const { factor: updated } = await adminApi.supersedeEmissionFactor(factor.id, { value: numericValue, source: source.trim() });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this factor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell title={`Edit — ${factor.name}`} onClose={onClose}>
      <p className="mt-1 text-xs text-muted-foreground">
        Current value {factor.value} {factor.unit}, effective {fmtDate(factor.validFrom)}. Saving supersedes this record —
        it&apos;s kept as history, not overwritten.
      </p>

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="edit-value">New value ({factor.unit})</Label>
          <Input id="edit-value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="edit-source">Source citation</Label>
          <Input
            id="edit-source"
            placeholder="Regulation / annex this value comes from"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <FieldError message={source && source.trim().length < 5 ? "Cite the regulation and annex this value comes from" : undefined} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------
// Add New Factor modal — full field set, creates a brand new record.
// -----------------------------------------------------------------------

const emptyNewFactor = {
  name: "",
  fuelType: "",
  greenhouseGas: "",
  value: "",
  unit: "",
  source: "",
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: "",
  sectorApplicability: "",
};

function AddFactorModal({ onClose, onSaved }: { onClose: () => void; onSaved: (created: EmissionFactor) => void }) {
  const [form, setForm] = useState(emptyNewFactor);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    const numericValue = Number(form.value);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (form.value === "" || Number.isNaN(numericValue)) {
      setError("Enter a numeric value.");
      return;
    }
    if (!form.unit.trim()) {
      setError("Unit is required.");
      return;
    }
    if (form.source.trim().length < 5) {
      setError("Cite the regulation and annex this value comes from.");
      return;
    }
    if (!form.validFrom) {
      setError("Valid From is required.");
      return;
    }
    if (!window.confirm(CONFIRM_MESSAGE)) return;

    setError(null);
    setIsSaving(true);
    try {
      const { factor } = await adminApi.createEmissionFactor({
        name: form.name.trim(),
        fuelType: form.fuelType.trim() || undefined,
        greenhouseGas: form.greenhouseGas.trim() || undefined,
        value: numericValue,
        unit: form.unit.trim(),
        source: form.source.trim(),
        validFrom: form.validFrom,
        validTo: form.validTo || undefined,
        sectorApplicability: form.sectorApplicability.trim() || undefined,
      });
      onSaved(factor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this factor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell title="Add New Factor" onClose={onClose}>
      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" value={form.name} onChange={set("name")} placeholder="e.g. Coking coal combustion factor" />
        </div>
        <div>
          <Label htmlFor="new-fuelType">Fuel Type</Label>
          <Input id="new-fuelType" value={form.fuelType} onChange={set("fuelType")} placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="new-ghg">Greenhouse Gas</Label>
          <Input id="new-ghg" value={form.greenhouseGas} onChange={set("greenhouseGas")} placeholder="e.g. CO2, CH4, N2O" />
        </div>
        <div>
          <Label htmlFor="new-value">Value</Label>
          <Input id="new-value" type="number" step="any" value={form.value} onChange={set("value")} />
        </div>
        <div>
          <Label htmlFor="new-unit">Unit</Label>
          <Input id="new-unit" value={form.unit} onChange={set("unit")} placeholder="e.g. tCO2/tonne" />
        </div>
        <div>
          <Label htmlFor="new-validFrom">Valid From</Label>
          <Input id="new-validFrom" type="date" value={form.validFrom} onChange={set("validFrom")} />
        </div>
        <div>
          <Label htmlFor="new-validTo">Valid To</Label>
          <Input id="new-validTo" type="date" value={form.validTo} onChange={set("validTo")} placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="new-sector">Sector Applicability</Label>
          <Input id="new-sector" value={form.sectorApplicability} onChange={set("sectorApplicability")} placeholder="e.g. STEEL, or ALL" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="new-source">Source citation</Label>
          <Input id="new-source" value={form.source} onChange={set("source")} placeholder="Regulation / annex this value comes from" />
          <FieldError
            message={form.source && form.source.trim().length < 5 ? "Cite the regulation and annex this value comes from" : undefined}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} isLoading={isSaving}>
          Create factor
        </Button>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------

function EmissionFactorsContent() {
  const [factors, setFactors] = useState<EmissionFactor[] | null>(null);
  const [search, setSearch] = useState("");
  const [editingFactor, setEditingFactor] = useState<EmissionFactor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = () => {
    adminApi.listEmissionFactors().then(({ factors }) => setFactors(factors));
  };

  useEffect(load, []);

  const cbamCertificatePrice = factors?.find((f) => f.name === "CBAM Certificate Price" && f.isCurrent);
  const ceaGridFactor = factors?.find((f) => f.name === "CEA Grid Emission Factor" && f.isCurrent);

  const filteredFactors = useMemo(() => {
    if (!factors) return null;
    const q = search.trim().toLowerCase();
    if (!q) return factors;
    return factors.filter((f) => f.name.toLowerCase().includes(q) || (f.fuelType ?? "").toLowerCase().includes(q));
  }, [factors, search]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <AdminTabs />

        <h1 className="mt-6 text-2xl font-semibold">Emission Factors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the reference values the calculation engine uses. Every change preserves the previous value as
          history rather than overwriting it.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <QuickUpdateCard
            title="CBAM Certificate Price"
            unit="EUR/tCO2e"
            valuePrefix="€"
            current={cbamCertificatePrice}
            linkHref={EU_CBAM_PRICE_PAGE_URL}
            linkLabel="EU CBAM certificate price page"
            onSave={async (value, source) => {
              const { factor } = await adminApi.updateCbamCertificatePrice({ value, source });
              setFactors((prev) => (prev ? replaceCurrentByName(prev, factor) : prev));
            }}
          />
          <QuickUpdateCard
            title="CEA Grid Emission Factor"
            unit="tCO2/MWh"
            current={ceaGridFactor}
            onSave={async (value, source) => {
              const { factor } = await adminApi.updateCeaGridFactor({ value, source });
              setFactors((prev) => (prev ? replaceCurrentByName(prev, factor) : prev));
            }}
          />
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">All emission factors</h2>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by name or fuel type…"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add New Factor
            </Button>
          </div>
        </div>

        {filteredFactors === null && (
          <div className="mt-8 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {filteredFactors && filteredFactors.length === 0 && (
          <Card className="mt-4 p-10 text-center text-sm text-muted-foreground">No emission factors match your search.</Card>
        )}

        {filteredFactors && filteredFactors.length > 0 && (
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Fuel Type</th>
                  <th className="px-4 py-3 font-medium">GHG</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Valid From</th>
                  <th className="px-4 py-3 font-medium">Valid To</th>
                  <th className="px-4 py-3 font-medium">Sector</th>
                  <th className="px-4 py-3 font-medium">Current</th>
                  <th className="px-4 py-3 font-medium text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredFactors.map((f) => (
                  <tr key={f.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.fuelType ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.greenhouseGas ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{f.value.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.unit}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground" title={f.source}>
                      {f.source}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(f.validFrom)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(f.validTo)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.sectorApplicability ?? "—"}</td>
                    <td className="px-4 py-3">
                      {f.isCurrent ? (
                        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                          Current
                        </span>
                      ) : (
                        <span className="rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Historical
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {f.isCurrent && (
                        <Button size="sm" variant="secondary" onClick={() => setEditingFactor(f)}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      {editingFactor && (
        <EditFactorModal
          factor={editingFactor}
          onClose={() => setEditingFactor(null)}
          onSaved={(updated) => {
            setFactors((prev) => (prev ? replaceCurrentByName(prev, updated) : prev));
            setEditingFactor(null);
          }}
        />
      )}

      {showAddModal && (
        <AddFactorModal
          onClose={() => setShowAddModal(false)}
          onSaved={(created) => {
            setFactors((prev) => (prev ? [created, ...prev] : [created]));
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

/** After a supersede, the old row flips isCurrent -> false and a new row is returned — replace the old current-by-name entry and prepend the new one, so the table reflects both without a full refetch. */
function replaceCurrentByName(factors: EmissionFactor[], updated: EmissionFactor): EmissionFactor[] {
  return [
    updated,
    ...factors.map((f) => (f.name === updated.name && f.isCurrent && f.id !== updated.id ? { ...f, isCurrent: false, validTo: updated.validFrom } : f)),
  ];
}

export default function EmissionFactorsPage() {
  return (
    <SuperAdminRoute>
      <EmissionFactorsContent />
    </SuperAdminRoute>
  );
}
