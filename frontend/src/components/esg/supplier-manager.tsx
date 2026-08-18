"use client";

import { useEffect, useState } from "react";
import { Loader2, Network, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ApiError, supplierApi } from "@/lib/api";
import type { Supplier } from "@/lib/types";

/**
 * Key supplier list.
 *
 * Spend share is asked for because it is what makes the coverage percentage
 * interpretable — without it the dashboard says so rather than letting "80% of
 * suppliers" be read as 80% of the supply base.
 */

const RISKS = [
  { value: "NOT_ASSESSED", label: "Not assessed" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const EMPTY = {
  name: "",
  sector: "",
  country: "",
  esgDisclosureType: "",
  riskFlag: "NOT_ASSESSED",
  spendSharePct: "",
  riskNotes: "",
};

export function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDisclosure, setHasDisclosure] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY });

  const load = () => {
    supplierApi
      .list()
      .then(({ suppliers }) => setSuppliers(suppliers))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load suppliers."));
  };
  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Key suppliers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Risk flags are your own assessment. We do not contact, screen, rate or verify suppliers.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add supplier
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {open && (
        <div className="mt-5 rounded-xl border border-surface-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-name">Supplier name</Label>
              <Input id="s-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-sector">Sector</Label>
              <Input id="s-sector" placeholder="Logistics" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-country">Country</Label>
              <Input id="s-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-risk">Risk flag (your assessment)</Label>
              <Select id="s-risk" value={form.riskFlag} onChange={(e) => set("riskFlag", e.target.value)}>
                {RISKS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="s-spend">
                Share of spend (%) <span className="text-muted">makes coverage interpretable</span>
              </Label>
              <Input id="s-spend" inputMode="decimal" value={form.spendSharePct} onChange={(e) => set("spendSharePct", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-disclosure">ESG disclosure held</Label>
              <Input
                id="s-disclosure"
                placeholder="CDP response 2025"
                value={form.esgDisclosureType}
                onChange={(e) => {
                  set("esgDisclosureType", e.target.value);
                  setHasDisclosure(e.target.value.trim().length > 0);
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              onClick={() =>
                run(async () => {
                  await supplierApi.create({ ...form, hasEsgDisclosure: hasDisclosure }, true);
                  setForm({ ...EMPTY });
                  setHasDisclosure(false);
                  setOpen(false);
                })
              }
            >
              Save supplier
            </Button>
          </div>
        </div>
      )}

      {suppliers === null && !error ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </div>
      ) : suppliers && suppliers.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Network className="h-4 w-4" />
          No suppliers listed.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {suppliers?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[s.sector, s.country].filter(Boolean).join(" · ")}
                  {s.spendSharePct != null && ` · ${s.spendSharePct}% of spend`}
                  {s.hasEsgDisclosure ? " · disclosure on file" : " · no disclosure"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => supplierApi.remove(s.id))}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
