"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CDP_RISK_KINDS,
  CDP_TIME_HORIZONS,
  CDP_TARGET_KINDS,
  CDP_BREAKDOWN_DIMENSIONS,
  CDP_BREAKDOWN_SCOPES,
} from "@/lib/cdp-questionnaire";
import {
  riskIncompleteReason,
  targetIncompleteReason,
  breakdownIncompleteReason,
  emptyRisk,
  emptyTarget,
  emptyBreakdown,
  type RiskRow,
  type TargetRow,
  type BreakdownRow,
} from "@/lib/cdp-rows";

/**
 * The three repeating blocks CDP asks for: risks and opportunities (C2.3 /
 * C2.4), emissions reduction targets (C4.1a / C4.1b), and emissions breakdown
 * rows (C7.1 / C7.2 / C7.3).
 *
 * The row shapes and the rules deciding when a row is complete enough to save
 * live in lib/cdp-rows, so they can be unit-tested against the API's own
 * refinements.
 *
 * A row is only sent to the server once its required fields are filled. Unlike
 * a scalar field, a half-built row has no meaningful empty state to store: a
 * target with no base year could not be rendered or submitted later, and the
 * API rejects it. So incomplete rows stay in the browser and say so, rather
 * than being silently dropped by an autosave the user cannot see fail.
 */

// ---------------------------------------------------------------------------

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

function RowShell({
  title,
  incompleteReason,
  onRemove,
  children,
}: {
  title: string;
  incompleteReason: string | null;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
      {children}
      {incompleteReason && <p className="mt-3 text-xs text-amber-500">{incompleteReason}</p>}
    </div>
  );
}

// --- C2 risks and opportunities --------------------------------------------

export function RiskEditor({
  kind,
  rows,
  onChange,
  onBlur,
  disabled,
}: {
  kind: "RISK" | "OPPORTUNITY";
  rows: RiskRow[];
  onChange: (rows: RiskRow[]) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  const mine = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.kind === kind);
  const noun = kind === "RISK" ? "risk" : "opportunity";
  const label = CDP_RISK_KINDS.find((k) => k.value === kind)!.label;

  const update = (index: number, patch: Partial<RiskRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">
            {kind === "RISK" ? "C2.3 Climate-related risks" : "C2.4 Climate-related opportunities"}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CDP asks for each {noun} as a separate entry, not as one block of prose.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange([...rows, { ...emptyRisk(kind) }])}
        >
          <Plus className="h-4 w-4" />
          Add {noun}
        </Button>
      </div>

      {mine.length === 0 && (
        <p className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-muted-foreground">
          No {noun} entered yet.
        </p>
      )}

      {mine.map(({ row, index }, position) => (
        <RowShell
          key={index}
          title={`${label} ${position + 1}`}
          incompleteReason={riskIncompleteReason(row)}
          onRemove={() => onChange(rows.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor={`risk-${index}-type`}>Type and primary driver</Label>
              <Input
                id={`risk-${index}-type`}
                placeholder="Transition — policy and legal"
                value={row.riskType}
                onChange={(e) => update(index, { riskType: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`risk-${index}-description`}>Description</Label>
              <textarea
                id={`risk-${index}-description`}
                rows={2}
                className={textareaClass}
                value={row.description}
                onChange={(e) => update(index, { description: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-stage`}>Where in the value chain</Label>
              <Input
                id={`risk-${index}-stage`}
                placeholder="Direct operations"
                value={row.valueChainStage}
                onChange={(e) => update(index, { valueChainStage: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-horizon`}>Time horizon</Label>
              <Select
                id={`risk-${index}-horizon`}
                value={row.timeHorizon}
                onChange={(e) => update(index, { timeHorizon: e.target.value })}
                onBlur={onBlur}
              >
                <option value="">Not stated</option>
                {CDP_TIME_HORIZONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`risk-${index}-likelihood`}>Likelihood</Label>
              <Input
                id={`risk-${index}-likelihood`}
                placeholder="Likely"
                value={row.likelihood}
                onChange={(e) => update(index, { likelihood: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-magnitude`}>Magnitude of impact</Label>
              <Input
                id={`risk-${index}-magnitude`}
                placeholder="Medium-high"
                value={row.magnitude}
                onChange={(e) => update(index, { magnitude: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-min`}>Financial effect — minimum</Label>
              <Input
                id={`risk-${index}-min`}
                inputMode="decimal"
                value={row.financialImpactMin}
                onChange={(e) => update(index, { financialImpactMin: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-max`}>Financial effect — maximum</Label>
              <Input
                id={`risk-${index}-max`}
                inputMode="decimal"
                value={row.financialImpactMax}
                onChange={(e) => update(index, { financialImpactMax: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`risk-${index}-impact`}>Explanation of the financial effect</Label>
              <textarea
                id={`risk-${index}-impact`}
                rows={2}
                className={textareaClass}
                value={row.impactDescription}
                onChange={(e) => update(index, { impactDescription: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`risk-${index}-response`}>
                How it is managed{" "}
                <span className="text-muted">— CDP weights this heavily</span>
              </Label>
              <textarea
                id={`risk-${index}-response`}
                rows={2}
                className={textareaClass}
                value={row.responseStrategy}
                onChange={(e) => update(index, { responseStrategy: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`risk-${index}-cost`}>Cost of management</Label>
              <Input
                id={`risk-${index}-cost`}
                inputMode="decimal"
                value={row.responseCost}
                onChange={(e) => update(index, { responseCost: e.target.value })}
                onBlur={onBlur}
              />
            </div>
          </div>
        </RowShell>
      ))}
    </div>
  );
}

// --- C4 targets ------------------------------------------------------------

export function TargetEditor({
  rows,
  onChange,
  onBlur,
  disabled,
}: {
  rows: TargetRow[];
  onChange: (rows: TargetRow[]) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<TargetRow>) =>
    onChange(rows.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">C4.1a / C4.1b Emissions reduction targets</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A target with a base year, a target year and a stated reduction is the single thing a requesting buyer
            most often looks for.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onChange([...rows, emptyTarget()])}>
          <Plus className="h-4 w-4" />
          Add target
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-muted-foreground">
          No target entered yet.
        </p>
      )}

      {rows.map((row, index) => (
        <RowShell
          key={index}
          title={`Target ${index + 1}`}
          incompleteReason={targetIncompleteReason(row)}
          onRemove={() => onChange(rows.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`target-${index}-kind`}>Target type</Label>
              <Select
                id={`target-${index}-kind`}
                value={row.kind}
                onChange={(e) => update(index, { kind: e.target.value })}
                onBlur={onBlur}
              >
                {CDP_TARGET_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`target-${index}-scopes`}>Scopes covered</Label>
              <Input
                id={`target-${index}-scopes`}
                placeholder="Scope 1 + 2 (location-based)"
                value={row.scopesCovered}
                onChange={(e) => update(index, { scopesCovered: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`target-${index}-baseYear`}>Base year</Label>
              <Input
                id={`target-${index}-baseYear`}
                inputMode="numeric"
                value={row.baseYear}
                onChange={(e) => update(index, { baseYear: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`target-${index}-targetYear`}>Target year</Label>
              <Input
                id={`target-${index}-targetYear`}
                inputMode="numeric"
                value={row.targetYear}
                onChange={(e) => update(index, { targetYear: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`target-${index}-baseEmissions`}>Base year emissions (tCO2e)</Label>
              <Input
                id={`target-${index}-baseEmissions`}
                inputMode="decimal"
                value={row.baseYearEmissionsTco2e}
                onChange={(e) => update(index, { baseYearEmissionsTco2e: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`target-${index}-reduction`}>Reduction against base year (%)</Label>
              <Input
                id={`target-${index}-reduction`}
                inputMode="decimal"
                value={row.reductionPct}
                onChange={(e) => update(index, { reductionPct: e.target.value })}
                onBlur={onBlur}
              />
            </div>

            {row.kind === "INTENSITY" && (
              <>
                <div className="sm:col-span-2">
                  <Label htmlFor={`target-${index}-metric`}>Intensity metric</Label>
                  <Input
                    id={`target-${index}-metric`}
                    placeholder="tCO2e per tonne of crude steel"
                    value={row.intensityMetric}
                    onChange={(e) => update(index, { intensityMetric: e.target.value })}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <Label htmlFor={`target-${index}-baseIntensity`}>Base year intensity</Label>
                  <Input
                    id={`target-${index}-baseIntensity`}
                    inputMode="decimal"
                    value={row.baseYearIntensity}
                    onChange={(e) => update(index, { baseYearIntensity: e.target.value })}
                    onBlur={onBlur}
                  />
                </div>
                <div>
                  <Label htmlFor={`target-${index}-targetIntensity`}>Target intensity</Label>
                  <Input
                    id={`target-${index}-targetIntensity`}
                    inputMode="decimal"
                    value={row.targetIntensity}
                    onChange={(e) => update(index, { targetIntensity: e.target.value })}
                    onBlur={onBlur}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor={`target-${index}-achieved`}>Progress achieved (%)</Label>
              <Input
                id={`target-${index}-achieved`}
                inputMode="decimal"
                value={row.percentAchieved}
                onChange={(e) => update(index, { percentAchieved: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-border accent-teal-500"
                  checked={row.isScienceBased}
                  onChange={(e) => update(index, { isScienceBased: e.target.checked })}
                  onBlur={onBlur}
                />
                Science-based target
              </label>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`target-${index}-description`}>Description</Label>
              <textarea
                id={`target-${index}-description`}
                rows={2}
                className={textareaClass}
                value={row.description}
                onChange={(e) => update(index, { description: e.target.value })}
                onBlur={onBlur}
              />
            </div>
          </div>
        </RowShell>
      ))}
    </div>
  );
}

// --- C7 breakdown rows -----------------------------------------------------

export function BreakdownEditor({
  rows,
  onChange,
  onBlur,
  disabled,
}: {
  rows: BreakdownRow[];
  onChange: (rows: BreakdownRow[]) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<BreakdownRow>) =>
    onChange(rows.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">C7.1 / C7.2 / C7.3 Emissions breakdown</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CDP asks for Scope 1 split by greenhouse gas and by country, and accepts further splits by business
            division and activity.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onChange([...rows, emptyBreakdown()])}>
          <Plus className="h-4 w-4" />
          Add row
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-muted-foreground">
          No breakdown rows entered yet.
        </p>
      )}

      {rows.map((row, index) => (
        <RowShell
          key={index}
          title={`Row ${index + 1}`}
          incompleteReason={breakdownIncompleteReason(row)}
          onRemove={() => onChange(rows.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor={`breakdown-${index}-dimension`}>Grouping</Label>
              <Select
                id={`breakdown-${index}-dimension`}
                value={row.dimension}
                onChange={(e) => update(index, { dimension: e.target.value })}
                onBlur={onBlur}
              >
                {CDP_BREAKDOWN_DIMENSIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`breakdown-${index}-scope`}>Scope</Label>
              <Select
                id={`breakdown-${index}-scope`}
                value={row.scope}
                onChange={(e) => update(index, { scope: e.target.value })}
                onBlur={onBlur}
              >
                {CDP_BREAKDOWN_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`breakdown-${index}-label`}>Label</Label>
              <Input
                id={`breakdown-${index}-label`}
                placeholder="CO2"
                value={row.label}
                onChange={(e) => update(index, { label: e.target.value })}
                onBlur={onBlur}
              />
            </div>
            <div>
              <Label htmlFor={`breakdown-${index}-emissions`}>tCO2e</Label>
              <Input
                id={`breakdown-${index}-emissions`}
                inputMode="decimal"
                value={row.emissionsTco2e}
                onChange={(e) => update(index, { emissionsTco2e: e.target.value })}
                onBlur={onBlur}
              />
            </div>
          </div>
        </RowShell>
      ))}
    </div>
  );
}
