"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import {
  CDP_MODULES,
  CDP_APPLICABILITY_NOTICE,
  CDP_SUBMISSION_NOTICE,
  CDP_SCORING_NOTICE,
  CDP_MATURITY_BAND_LABELS,
  type CdpQuestion,
  type CdpMaturityBand,
} from "@/lib/cdp-questionnaire";
import { cdpApi, ApiError } from "@/lib/api";
import type { CdpReport, CdpMetrics, CdpMaturityAssessment, CdpModuleRow } from "@/lib/types";
import { RiskEditor, TargetEditor, BreakdownEditor } from "./cdp-repeating-blocks";
import {
  isRiskComplete,
  isTargetComplete,
  isBreakdownComplete,
  type RiskRow,
  type TargetRow,
  type BreakdownRow,
} from "@/lib/cdp-rows";

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const toStr = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const inputModeFor = (t: CdpQuestion["type"]) => (t === "int" || t === "year" ? "numeric" : "decimal");

const BAND_CLASS: Record<CdpMaturityBand, string> = {
  STRONG: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  ESTABLISHED: "border-teal-500/20 bg-teal-500/5 text-teal-500",
  DEVELOPING: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  NOT_STARTED: "border-surface-border bg-surface-raised text-muted-foreground",
};

function BandChip({ band }: { band: CdpMaturityBand }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${BAND_CLASS[band]}`}>
      {CDP_MATURITY_BAND_LABELS[band]}
    </span>
  );
}

export function CdpModuleForm({
  facilityId,
  reportingPeriod,
  report,
  metrics,
  maturity,
}: {
  facilityId: string;
  reportingPeriod: string;
  report: CdpReport | null;
  metrics: CdpMetrics | null;
  maturity: CdpMaturityAssessment | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAlreadySubmitted = report?.status === "SUBMITTED";

  const [revenue, setRevenue] = useState(toStr(report?.revenue));
  const [notes, setNotes] = useState(report?.notes ?? "");

  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      CDP_MODULES.map((mod) => {
        const row = ((report as unknown as Record<string, unknown>)?.[mod.relation] ?? {}) as CdpModuleRow;
        return [
          mod.code,
          Object.fromEntries(
            mod.questions.filter((q) => !q.derived).map((q) => [q.field, toStr(row?.[q.field])]),
          ),
        ];
      }),
    ),
  );

  const [risks, setRisks] = useState<RiskRow[]>(() =>
    (report?.risks ?? []).map((r) => ({
      kind: r.kind,
      riskType: r.riskType,
      description: r.description,
      valueChainStage: toStr(r.valueChainStage),
      timeHorizon: toStr(r.timeHorizon),
      likelihood: toStr(r.likelihood),
      magnitude: toStr(r.magnitude),
      financialImpactMin: toStr(r.financialImpactMin),
      financialImpactMax: toStr(r.financialImpactMax),
      impactDescription: toStr(r.impactDescription),
      responseStrategy: toStr(r.responseStrategy),
      responseCost: toStr(r.responseCost),
    })),
  );

  const [targets, setTargets] = useState<TargetRow[]>(() =>
    (report?.targets ?? []).map((t) => ({
      kind: t.kind,
      scopesCovered: t.scopesCovered,
      baseYear: toStr(t.baseYear),
      baseYearEmissionsTco2e: toStr(t.baseYearEmissionsTco2e),
      targetYear: toStr(t.targetYear),
      reductionPct: toStr(t.reductionPct),
      intensityMetric: toStr(t.intensityMetric),
      baseYearIntensity: toStr(t.baseYearIntensity),
      targetIntensity: toStr(t.targetIntensity),
      percentAchieved: toStr(t.percentAchieved),
      isScienceBased: t.isScienceBased,
      description: toStr(t.description),
    })),
  );

  const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>(() =>
    (report?.breakdownRows ?? []).map((b) => ({
      dimension: b.dimension,
      scope: b.scope,
      label: b.label,
      emissionsTco2e: toStr(b.emissionsTco2e),
    })),
  );

  /**
   * Incomplete rows are filtered out rather than sent. The API rejects a row
   * missing its required fields, and one rejected row would fail the whole
   * autosave — losing everything else the user had typed. Each filtered row
   * says on screen why it is not saved yet, so nothing disappears silently.
   */
  const buildPayload = () => ({
    reportingPeriod,
    revenue: revenue || undefined,
    notes: notes || undefined,
    modules: Object.fromEntries(
      CDP_MODULES.map((mod) => [
        mod.code,
        Object.fromEntries(Object.entries(values[mod.code] ?? {}).map(([k, v]) => [k, v || undefined])),
      ]),
    ),
    risks: risks.filter(isRiskComplete).map((r) => ({
      kind: r.kind,
      riskType: r.riskType,
      description: r.description,
      valueChainStage: r.valueChainStage || undefined,
      timeHorizon: r.timeHorizon || undefined,
      likelihood: r.likelihood || undefined,
      magnitude: r.magnitude || undefined,
      financialImpactMin: r.financialImpactMin || undefined,
      financialImpactMax: r.financialImpactMax || undefined,
      impactDescription: r.impactDescription || undefined,
      responseStrategy: r.responseStrategy || undefined,
      responseCost: r.responseCost || undefined,
    })),
    targets: targets.filter(isTargetComplete).map((t) => ({
      kind: t.kind,
      scopesCovered: t.scopesCovered,
      baseYear: t.baseYear,
      baseYearEmissionsTco2e: t.baseYearEmissionsTco2e || undefined,
      targetYear: t.targetYear,
      reductionPct: t.reductionPct || undefined,
      intensityMetric: t.intensityMetric || undefined,
      baseYearIntensity: t.baseYearIntensity || undefined,
      targetIntensity: t.targetIntensity || undefined,
      percentAchieved: t.percentAchieved || undefined,
      isScienceBased: t.isScienceBased,
      description: t.description || undefined,
    })),
    breakdownRows: breakdownRows.filter(isBreakdownComplete).map((b) => ({
      dimension: b.dimension,
      scope: b.scope,
      label: b.label,
      emissionsTco2e: b.emissionsTco2e,
    })),
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    await cdpApi.save(facilityId, buildPayload(), false);
  });

  const onBlurAutosave = () => {
    if (!isAlreadySubmitted) triggerAutosave();
  };

  const onSubmit = async () => {
    setServerError(null);
    setSubmitting(true);
    try {
      await cdpApi.save(facilityId, buildPayload(), true);
      router.push(`/facilities/${facilityId}/cdp/${encodeURIComponent(reportingPeriod)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: CdpQuestion, moduleCode: string) => {
    const id = `${moduleCode}-${question.field}`;
    const value = values[moduleCode]?.[question.field] ?? "";
    const onChange = (v: string) =>
      setValues((p) => ({ ...p, [moduleCode]: { ...p[moduleCode], [question.field]: v } }));

    return (
      <div key={id} className={question.type === "narrative" ? "sm:col-span-2" : undefined}>
        <Label htmlFor={id}>
          <span className="text-muted-foreground">{question.code}</span> {question.label}
          {question.unit && <span className="text-muted"> ({question.unit})</span>}
        </Label>
        {question.type === "narrative" ? (
          <textarea
            id={id}
            rows={3}
            className={textareaClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        ) : question.type === "bool" ? (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlurAutosave}>
            <option value="">Not answered</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        ) : question.type === "select" ? (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlurAutosave}>
            <option value="">Not answered</option>
            {question.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id={id}
            inputMode={inputModeFor(question.type)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        )}
        {question.hint && <p className="mt-1 text-xs text-muted-foreground">{question.hint}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reporting period <span className="font-medium text-foreground">{reportingPeriod}</span>
        </p>
        {!isAlreadySubmitted && <AutosaveIndicator status={autosaveStatus} />}
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}
      {isAlreadySubmitted && (
        <Alert variant="info">
          This response has already been marked complete. Changes here only save when you resubmit below.
        </Alert>
      )}

      {/* The applicability notice is the first thing on the page and cannot be
          dismissed. CDP is not a mandate, and this module must never be the
          reason somebody believes otherwise. */}
      <Card className="border-teal-500/30 p-6">
        <div className="flex items-start gap-3">
          <ShoppingCart className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
          <div>
            <h2 className="font-medium">CDP is requested by a customer or investor — it is not a legal requirement</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">{CDP_APPLICABILITY_NOTICE}</p>
            <p className="mt-2.5 text-xs font-medium text-foreground">{CDP_SUBMISSION_NOTICE}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              If you cannot identify who asked you to respond, check before spending time here — you very likely do
              not need to.
            </p>
          </div>
        </div>
      </Card>

      {maturity && !maturity.registryReconciled && (
        <Card className="border-amber-500/30 p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h2 className="font-medium">Question numbering not yet reconciled</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                CDP reissues its questionnaire annually, and consolidated its separate questionnaires into a single
                unified corporate questionnaire in 2024, which renumbered questions away from the classic C0–C15
                lettering used here. {maturity.confirmedQuestions} of {maturity.totalQuestions} question codes have
                been reconciled against a questionnaire CDP actually issued. Until that is done, match questions by
                subject matter rather than by number when transferring your answers into CDP&apos;s platform. This is
                a limitation of this tool, not of your answers — everything you enter is kept in full.
              </p>
            </div>
          </div>
        </Card>
      )}

      {maturity && (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            {maturity.overallBand === "STRONG" || maturity.overallBand === "ESTABLISHED" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">Response readiness</h2>
                <BandChip band={maturity.overallBand} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {maturity.answered} of {maturity.total} questions answered · {maturity.completenessPct}% complete
              </p>
              {/* The disclaimer sits with the number, not in a footnote — a
                  band next to a percentage reads as a grade unless it says
                  otherwise right there. */}
              <p className="mt-2 text-xs text-muted-foreground">{CDP_SCORING_NOTICE}</p>

              {maturity.modules.some((m) => m.evidenceGaps.length > 0) && (
                <>
                  <p className="mt-4 text-xs font-medium text-foreground">
                    Holding modules below their answered level
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {maturity.modules
                      .filter((m) => m.evidenceGaps.length > 0)
                      .flatMap((m) =>
                        m.evidenceGaps.map((gap, i) => (
                          <li key={`${m.moduleCode}-${i}`} className="flex gap-2 text-xs text-muted-foreground">
                            <span className="text-amber-500">•</span>
                            <span>
                              <span className="font-medium text-foreground">{m.label}</span> {gap}
                            </span>
                          </li>
                        )),
                      )}
                  </ul>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-medium">Reporting basis</h2>
        <div className="mt-4 max-w-sm">
          <Label htmlFor="revenue">Revenue</Label>
          <Input
            id="revenue"
            inputMode="decimal"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            onBlur={onBlurAutosave}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Denominator for C6.10, combined Scope 1 and 2 per unit of revenue. Enter it in the currency you state at
            C0.4 — CDP requires one currency across the whole response.
          </p>
        </div>
        {metrics && metrics.intensityPerRevenue != null && (
          <p className="mt-3 text-xs text-muted-foreground">
            C6.10 currently resolves to {metrics.intensityPerRevenue.toExponential(3)} tCO2e per unit revenue.
          </p>
        )}
      </Card>

      {CDP_MODULES.map((mod) => {
        const record = maturity?.modules.find((m) => m.moduleCode === mod.code);
        const derived = mod.questions.filter((q) => q.derived);

        return (
          <Card key={mod.code} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                <span className="text-muted-foreground">{mod.label}</span> {mod.title}
                {mod.optional && <span className="ml-2 text-xs font-normal text-muted">Optional</span>}
              </h3>
              {record && (
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {record.answered} / {record.total}
                  </span>
                  <BandChip band={record.band} />
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{mod.blurb}</p>

            {mod.optional && (
              <p className="mt-2 text-xs text-muted-foreground">
                CDP issues this module only to companies in the sectors it applies to. If your buyer did not ask for
                it, leaving it blank costs you nothing — it is excluded from your completeness until you start it.
              </p>
            )}

            {record?.evidenceGaps.map((gap, i) => (
              <p key={i} className="mt-2 text-xs text-amber-500">
                {gap}
              </p>
            ))}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mod.questions.filter((q) => !q.derived).map((q) => renderQuestion(q, mod.code))}
            </div>

            {derived.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                {derived.map((d) => d.code).join(", ")} are calculated from data you have already entered elsewhere on
                the platform and are not asked for here.
              </p>
            )}

            {mod.code === "C2" && (
              <div className="mt-6 space-y-6 border-t border-surface-border pt-5">
                <RiskEditor
                  kind="RISK"
                  rows={risks}
                  onChange={setRisks}
                  onBlur={onBlurAutosave}
                  disabled={isAlreadySubmitted}
                />
                <RiskEditor
                  kind="OPPORTUNITY"
                  rows={risks}
                  onChange={setRisks}
                  onBlur={onBlurAutosave}
                  disabled={isAlreadySubmitted}
                />
              </div>
            )}

            {mod.code === "C4" && (
              <div className="mt-6 border-t border-surface-border pt-5">
                <TargetEditor
                  rows={targets}
                  onChange={setTargets}
                  onBlur={onBlurAutosave}
                  disabled={isAlreadySubmitted}
                  registerTargetCount={metrics?.targets.fromCompanyTarget ? metrics.targets.rows.length : 0}
                />
              </div>
            )}

            {mod.code === "C7" && (
              <div className="mt-6 border-t border-surface-border pt-5">
                <BreakdownEditor
                  rows={breakdownRows}
                  onChange={setBreakdownRows}
                  onBlur={onBlurAutosave}
                  disabled={isAlreadySubmitted}
                />
              </div>
            )}

            {mod.code === "C11" && metrics && metrics.carbonPricingExposure.observedSystems.length > 0 && (
              <div className="mt-6 border-t border-surface-border pt-5">
                <h4 className="text-sm font-medium">Carbon pricing systems this platform can see</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  From your CBAM and CCTS records. This is a prompt, not an answer — whether an operation is actually
                  regulated depends on entity-level facts we do not hold, so confirm each one before entering it at
                  C11.1a.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {metrics.carbonPricingExposure.observedSystems.map((s) => (
                    <li key={s} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-teal-500">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}

      <Card className="p-6">
        <Label htmlFor="notes">
          Notes <span className="text-muted">(optional)</span>
        </Label>
        <textarea
          id="notes"
          rows={3}
          className={textareaClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onBlurAutosave}
        />
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto max-w-md text-xs text-muted-foreground">
          CDP accepts a partial response and scores it accordingly, so you do not have to answer everything before
          marking this complete — only C0.1 and C15.1 are required.
        </p>
        <Button type="button" onClick={onSubmit} isLoading={submitting}>
          {isAlreadySubmitted ? "Resubmit response" : "Mark response complete"}
        </Button>
      </div>
    </div>
  );
}
