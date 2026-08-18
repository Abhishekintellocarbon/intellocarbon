"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ProductFootprintCard } from "@/components/dashboard/esg/product-footprint-card";
import { ApiError, productSkuApi } from "@/lib/api";

/**
 * Product entry and the resulting allocation for one facility.
 *
 * Bundled together because the allocation only means anything next to the list
 * it was computed from — the per-unit figures move whenever a product is added
 * or removed, and seeing that happen is the point.
 *
 * Renders nothing for a company without the ESG bundle, like CdpSection.
 */

const suggestedFy = (): string => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

interface SkuRow {
  id: string;
  name: string;
  skuCode: string | null;
  productionQuantity: number;
  unit: string;
}

export function ProductSkuSection({ facilityId }: { facilityId: string }) {
  const [period, setPeriod] = useState(suggestedFy());
  const [skus, setSkus] = useState<SkuRow[] | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ name: "", skuCode: "", productionQuantity: "", unit: "tonnes" });

  useEffect(() => {
    productSkuApi
      .getAllocation(facilityId, period)
      .then(({ skus }) => setSkus(skus as SkuRow[]))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        setSkus([]);
      });
  }, [facilityId, period, reloadKey]);

  if (notSubscribed) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-10 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Product footprint</h2>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Reporting period"
            className="h-9 w-32"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {open && (
        <Card className="mb-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="p-name">Product name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="p-code">SKU code</Label>
              <Input id="p-code" value={form.skuCode} onChange={(e) => setForm({ ...form, skuCode: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="p-qty">Output</Label>
              <Input
                id="p-qty"
                inputMode="decimal"
                value={form.productionQuantity}
                onChange={(e) => setForm({ ...form, productionQuantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-unit">Unit</Label>
              <Input id="p-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Use the same unit as your activity data production figures where you can — coverage against the
            facility&apos;s output can only be shown when the units match.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              onClick={() =>
                run(async () => {
                  await productSkuApi.create({ ...form, facilityId, reportingPeriod: period }, true);
                  setForm({ name: "", skuCode: "", productionQuantity: "", unit: "tonnes" });
                  setOpen(false);
                })
              }
            >
              Save product
            </Button>
          </div>
        </Card>
      )}

      {skus === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {skus.length > 0 && (
            <div className="mb-4 space-y-2">
              {skus.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-2.5">
                  <span className="min-w-0 text-sm">
                    {s.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.productionQuantity.toLocaleString("en-IN")} {s.unit}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => productSkuApi.remove(s.id))}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {skus.length === 0 && (
            <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              No products listed for {period}.
            </p>
          )}
          <ProductFootprintCard key={reloadKey} facilityId={facilityId} period={period} />
        </>
      )}
    </>
  );
}
