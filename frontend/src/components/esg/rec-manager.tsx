"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ApiError, facilityApi, recApi } from "@/lib/api";
import type { Facility, RecPurchase } from "@/lib/types";

/**
 * Renewable energy certificate ledger.
 *
 * Vintage year is asked for separately from purchase date and labelled, because
 * coverage matches on vintage — a certificate bought this year for last year's
 * generation counts against last year, and entering the purchase year here
 * would silently misplace it.
 */

const REGISTRIES = [
  { value: "INDIA_REC_CERC", label: "India REC (CERC)" },
  { value: "I_REC", label: "I-REC" },
  { value: "TIGR", label: "TIGR" },
  { value: "GUARANTEE_OF_ORIGIN", label: "Guarantee of Origin (EU)" },
  { value: "GREEN_E", label: "Green-e" },
  { value: "OTHER", label: "Other" },
];

const EMPTY = {
  facilityId: "",
  registry: "INDIA_REC_CERC",
  certificateReference: "",
  quantityMwh: "",
  vintageYear: "",
  purchaseDate: "",
  notes: "",
};

export function RecManager() {
  const [purchases, setPurchases] = useState<RecPurchase[] | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY });

  const load = () => {
    recApi
      .list()
      .then(({ purchases }) => setPurchases(purchases))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load certificates."));
  };

  useEffect(() => {
    load();
    facilityApi.list().then(({ facilities }) => setFacilities(facilities)).catch(() => setFacilities([]));
  }, []);

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
          <h2 className="font-medium">Renewable energy certificates</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tracking only — we do not verify certificates or check them against a registry.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add certificate
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
              <Label htmlFor="r-facility">Facility</Label>
              <Select id="r-facility" value={form.facilityId} onChange={(e) => set("facilityId", e.target.value)}>
                <option value="">Select a facility</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="r-registry">Registry</Label>
              <Select id="r-registry" value={form.registry} onChange={(e) => set("registry", e.target.value)}>
                {REGISTRIES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="r-ref">Certificate reference</Label>
              <Input id="r-ref" value={form.certificateReference} onChange={(e) => set("certificateReference", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="r-qty">Quantity (MWh)</Label>
              <Input id="r-qty" inputMode="decimal" value={form.quantityMwh} onChange={(e) => set("quantityMwh", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="r-vintage">
                Vintage year <span className="text-muted">(year of generation, not purchase)</span>
              </Label>
              <Input id="r-vintage" inputMode="numeric" value={form.vintageYear} onChange={(e) => set("vintageYear", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="r-date">Purchase date</Label>
              <Input id="r-date" type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
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
                  await recApi.create(form, true);
                  setForm({ ...EMPTY });
                  setOpen(false);
                })
              }
            >
              Save certificate
            </Button>
          </div>
        </div>
      )}

      {purchases === null && !error ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </div>
      ) : purchases && purchases.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="h-4 w-4" />
          No certificates recorded.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {purchases?.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.quantityMwh.toLocaleString("en-IN")} MWh · vintage {p.vintageYear}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.certificateReference} · {p.facility?.name ?? ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => recApi.remove(p.id))}
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
