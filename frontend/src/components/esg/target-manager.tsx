"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { ApiError, targetApi } from "@/lib/api";
import type { CompanyTargetsSummary } from "@/lib/types";

/**
 * Entry for company reduction targets.
 *
 * The SBTi status field is the one to be careful with: it records what the
 * company says about its own submission, and the option labels say
 * "self-reported" so nobody reads the stored value — or the dashboard badge
 * built from it — as validation by anyone here.
 */

const EMPTY = {
  kind: "ABSOLUTE",
  scopesCovered: "Scope 1+2 (location-based)",
  baselineYear: "",
  baselineEmissionsTco2e: "",
  targetYear: "",
  reductionPct: "",
  intensityMetric: "",
  isNetZero: false,
  sbtiStatus: "NOT_SUBMITTED",
  description: "",
};

const SBTI_OPTIONS = [
  { value: "NOT_SUBMITTED", label: "Not submitted to SBTi" },
  { value: "COMMITTED", label: "Commitment letter submitted (self-reported)" },
  { value: "SUBMITTED", label: "Target submitted to SBTi (self-reported)" },
  { value: "VALIDATED", label: "Validated by SBTi (self-reported)" },
];

export function TargetManager() {
  const [data, setData] = useState<CompanyTargetsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({ ...EMPTY });

  const load = () => {
    targetApi
      .list()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load targets."));
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

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Reduction targets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Self-reported. Intellocarbon does not validate targets and has no relationship with the Science Based
            Targets initiative.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add target
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
              <Label htmlFor="t-kind">Target type</Label>
              <Select id="t-kind" value={String(form.kind)} onChange={(e) => set("kind", e.target.value)}>
                <option value="ABSOLUTE">Absolute</option>
                <option value="INTENSITY">Intensity</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-scopes">Scopes covered</Label>
              <Input id="t-scopes" value={String(form.scopesCovered)} onChange={(e) => set("scopesCovered", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-baseYear">Baseline year</Label>
              <Input id="t-baseYear" inputMode="numeric" value={String(form.baselineYear)} onChange={(e) => set("baselineYear", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-baseEm">Baseline emissions (tCO₂e)</Label>
              <Input id="t-baseEm" inputMode="decimal" value={String(form.baselineEmissionsTco2e)} onChange={(e) => set("baselineEmissionsTco2e", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-targetYear">Target year</Label>
              <Input id="t-targetYear" inputMode="numeric" value={String(form.targetYear)} onChange={(e) => set("targetYear", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-reduction">Reduction (%)</Label>
              <Input id="t-reduction" inputMode="decimal" value={String(form.reductionPct)} onChange={(e) => set("reductionPct", e.target.value)} />
            </div>
            {form.kind === "INTENSITY" && (
              <div className="sm:col-span-2">
                <Label htmlFor="t-metric">Intensity metric</Label>
                <Input id="t-metric" placeholder="tCO₂e per tonne of product" value={String(form.intensityMetric)} onChange={(e) => set("intensityMetric", e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="t-sbti">SBTi status (self-reported)</Label>
              <Select id="t-sbti" value={String(form.sbtiStatus)} onChange={(e) => set("sbtiStatus", e.target.value)}>
                {SBTI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-border accent-teal-500"
                  checked={Boolean(form.isNetZero)}
                  onChange={(e) => set("isNetZero", e.target.checked)}
                />
                Net-zero commitment
              </label>
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
                  await targetApi.create(form, true);
                  setForm({ ...EMPTY });
                  setOpen(false);
                })
              }
            >
              Save target
            </Button>
          </div>
        </div>
      )}

      {data === null && !error ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </div>
      ) : data && data.targets.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          No targets yet.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {data?.targets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {t.reductionPct != null ? `${t.reductionPct}% by ${t.targetYear}` : `Target ${t.targetYear}`}
                  {t.isNetZero && <span className="text-xs text-teal-500">Net zero</span>}
                  {t.status === "DRAFT" ? <DraftBadge /> : <SubmittedBadge />}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.scopesCovered} · baseline {t.baselineYear} ({t.baselineEmissionsTco2e.toLocaleString("en-IN")} tCO₂e)
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => targetApi.remove(t.id))}
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
