"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import {
  ESRS_2_DATAPOINTS,
  ESRS_STANDARDS,
  ESRS_MDR_FIELDS,
  getEsrsStandard,
  type EsrsDatapoint,
} from "@/lib/esrs-standards";
import { csrdApi, ApiError } from "@/lib/api";
import type { CsrdReport, CsrdMetrics, CsrdStandardRow } from "@/lib/types";

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const toStr = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const inputModeFor = (t: EsrsDatapoint["type"]) => (t === "int" || t === "year" ? "numeric" : "decimal");

export function CsrdDatapointForm({
  facilityId,
  reportingPeriod,
  report,
  metrics,
}: {
  facilityId: string;
  reportingPeriod: string;
  report: CsrdReport;
  metrics: CsrdMetrics | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAlreadySubmitted = report.status === "SUBMITTED";

  const [netRevenueEur, setNetRevenueEur] = useState(toStr(report.netRevenueEur));
  const [notes, setNotes] = useState(report.notes ?? "");

  const [general, setGeneral] = useState<Record<string, string>>(() => {
    const row = (report.generalDisclosures ?? {}) as CsrdStandardRow;
    return Object.fromEntries(ESRS_2_DATAPOINTS.filter((d) => !d.derived).map((d) => [d.field, toStr(row[d.field])]));
  });

  const materialStandards = ESRS_STANDARDS.filter(
    (s) => report.materialTopics.find((t) => t.standardCode === s.code)?.isMaterial,
  );
  const excludedStandards = ESRS_STANDARDS.filter(
    (s) => report.materialTopics.find((t) => t.standardCode === s.code)?.isMaterial === false,
  );

  const [mdr, setMdr] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      materialStandards.map((s) => {
        const record = report.materialTopics.find((t) => t.standardCode === s.code);
        return [
          s.code,
          Object.fromEntries(
            ESRS_MDR_FIELDS.map((f) => [f.name, toStr((record as unknown as Record<string, unknown>)?.[f.name])]),
          ),
        ];
      }),
    ),
  );

  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      materialStandards.map((s) => {
        const row = ((report as unknown as Record<string, unknown>)[s.relation] ?? {}) as CsrdStandardRow;
        return [s.code, Object.fromEntries(s.datapoints.filter((d) => !d.derived).map((d) => [d.field, toStr(row[d.field])]))];
      }),
    ),
  );

  const buildPayload = () => ({
    reportingPeriod,
    netRevenueEur: netRevenueEur || undefined,
    notes: notes || undefined,
    general: Object.fromEntries(Object.entries(general).map(([k, v]) => [k, v || undefined])),
    materialTopics: materialStandards.map((s) => ({
      standardCode: s.code,
      isMaterial: true,
      ...Object.fromEntries(ESRS_MDR_FIELDS.map((f) => [f.name, mdr[s.code]?.[f.name] || undefined])),
    })),
    // Only material standards are sent — the backend rejects a payload for a
    // non-material one, so this avoids a guaranteed 400 when a re-run
    // assessment de-materialises a standard while the form is open.
    standards: Object.fromEntries(
      materialStandards.map((s) => [
        s.code,
        Object.fromEntries(Object.entries(values[s.code] ?? {}).map(([k, v]) => [k, v || undefined])),
      ]),
    ),
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    await csrdApi.save(facilityId, buildPayload(), false);
  });

  const onBlurAutosave = () => {
    if (!isAlreadySubmitted) triggerAutosave();
  };

  const onSubmit = async () => {
    setServerError(null);
    setSubmitting(true);
    try {
      await csrdApi.save(facilityId, buildPayload(), true);
      router.push(`/facilities/${facilityId}/csrd/${encodeURIComponent(reportingPeriod)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderDatapoint = (
    dp: EsrsDatapoint,
    value: string,
    onChange: (v: string) => void,
    idPrefix: string,
  ) => {
    const id = `${idPrefix}-${dp.field}`;
    return (
      <div key={id} className={dp.type === "narrative" ? "sm:col-span-2" : undefined}>
        <Label htmlFor={id}>
          <span className="text-muted-foreground">{dp.code}</span> {dp.label}
          {dp.unit && <span className="text-muted"> ({dp.unit})</span>}
        </Label>
        {dp.type === "narrative" ? (
          <textarea
            id={id}
            rows={3}
            className={textareaClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        ) : dp.type === "bool" ? (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlurAutosave}>
            <option value="">Not reported</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        ) : (
          <Input
            id={id}
            inputMode={inputModeFor(dp.type)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        )}
        {dp.hint && <p className="mt-1 text-xs text-muted-foreground">{dp.hint}</p>}
        {dp.phaseIn && (
          <p className="mt-1 text-xs text-amber-500">Phase-in relief available: {dp.phaseIn}</p>
        )}
      </div>
    );
  };

  const conformity = metrics?.conformity;

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
          This statement has already been submitted. Changes here only save when you resubmit below.
        </Alert>
      )}

      {/* The reconciliation notice is about this tool, not the preparer's data,
          and is labelled as such so nobody reads it as their own gap. */}
      {conformity && !conformity.registryReconciled && (
        <Card className="border-amber-500/30 p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h2 className="font-medium">Datapoint definitions not yet reconciled</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The revised ESRS (2026) standards apply from FY2027 and reduce the datapoint set substantially.{" "}
                {conformity.confirmedDatapoints} of {conformity.totalDatapoints} definitions in this tool have been
                reconciled against the adopted text. Until that is complete, statements are issued as prepared with
                reference to the ESRS and must not be filed as conformant. This is a limitation of the tool, not of
                the information you provide — everything you enter here is retained.
              </p>
            </div>
          </div>
        </Card>
      )}

      {conformity && (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            {conformity.conformant ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div className="min-w-0">
              <h2 className="font-medium">
                {conformity.conformant ? "Conformant with ESRS" : "Currently: prepared with reference to ESRS"}
              </h2>
              {!conformity.conformant && (
                <ul className="mt-3 space-y-1.5">
                  {conformity.blockers.map((b, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-amber-500">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {conformity.generalDisclosuresReported} of {conformity.generalDisclosuresTotal} ESRS 2 disclosures ·{" "}
                {conformity.materialStandardCount} material standards
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-medium">Reporting basis</h2>
        <div className="mt-4 max-w-sm">
          <Label htmlFor="netRevenueEur">Net revenue (EUR)</Label>
          <Input
            id="netRevenueEur"
            inputMode="decimal"
            value={netRevenueEur}
            onChange={(e) => setNetRevenueEur(e.target.value)}
            onBlur={onBlurAutosave}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Denominator for the ESRS intensity datapoints (E1-5d, E1-6e, E3-4e). ESRS states these per euro of net
            revenue, so this is held in EUR rather than converted from rupees.
          </p>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">ESRS 2 — General Disclosures</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reported by every undertaking regardless of the materiality assessment.
        </p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ESRS_2_DATAPOINTS.filter((d) => !d.derived).map((dp) =>
            renderDatapoint(dp, general[dp.field] ?? "", (v) => setGeneral((p) => ({ ...p, [dp.field]: v })), "esrs2"),
          )}
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Topical standards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown because your double materiality assessment determined them material.{" "}
          <Link
            href={`/facilities/${facilityId}/csrd/${encodeURIComponent(reportingPeriod)}/materiality`}
            className="font-medium text-teal-500 hover:underline"
          >
            Re-run the assessment
          </Link>{" "}
          to change which standards appear here.
        </p>
      </div>

      {materialStandards.map((standard) => {
        const record = report.materialTopics.find((t) => t.standardCode === standard.code);
        const completeness = conformity?.standards.find((s) => s.standardCode === standard.code);
        const via =
          record?.impactMaterial && record?.financialMaterial
            ? "impact and financial materiality"
            : record?.impactMaterial
              ? "impact materiality"
              : "financial materiality";

        return (
          <Card key={standard.code} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                <span className="text-muted-foreground">{standard.label}</span> {standard.title}
              </h3>
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
                Material via {via}
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-surface-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-medium">Minimum disclosure requirements</h4>
                {completeness && !completeness.minimumDisclosuresComplete && (
                  <span className="text-[11px] font-medium text-amber-500">
                    {completeness.missingMinimumDisclosures.length} of {ESRS_MDR_FIELDS.length} outstanding
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-4">
                {ESRS_MDR_FIELDS.map((f) => (
                  <div key={f.name}>
                    <Label htmlFor={`mdr-${standard.code}-${f.name}`}>{f.label}</Label>
                    <textarea
                      id={`mdr-${standard.code}-${f.name}`}
                      rows={2}
                      className={textareaClass}
                      placeholder={f.hint}
                      value={mdr[standard.code]?.[f.name] ?? ""}
                      onChange={(e) =>
                        setMdr((p) => ({ ...p, [standard.code]: { ...p[standard.code], [f.name]: e.target.value } }))
                      }
                      onBlur={onBlurAutosave}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {standard.datapoints
                .filter((d) => !d.derived)
                .map((dp) =>
                  renderDatapoint(
                    dp,
                    values[standard.code]?.[dp.field] ?? "",
                    (v) => setValues((p) => ({ ...p, [standard.code]: { ...p[standard.code], [dp.field]: v } })),
                    standard.code,
                  ),
                )}
            </div>

            {standard.datapoints.some((d) => d.derived) && (
              <p className="mt-4 text-xs text-muted-foreground">
                {standard.datapoints.filter((d) => d.derived).map((d) => d.code).join(", ")} are derived from data you
                have already entered and are not asked for here.
              </p>
            )}
          </Card>
        );
      })}

      {excludedStandards.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Not material for this facility</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Assessed and below both thresholds. ESRS requires the statement to be explicit about what was excluded,
            so these are recorded in the disclosure index with the rationale below rather than silently omitted.
          </p>
          <div className="mt-4 space-y-2">
            {excludedStandards.map((standard) => {
              const record = report.materialTopics.find((t) => t.standardCode === standard.code);
              return (
                <div key={standard.code} className="rounded-xl border border-surface-border px-4 py-3">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{standard.label}</span> {standard.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {record?.notMaterialRationale ?? "No rationale stated."}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

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

      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit} isLoading={submitting}>
          {isAlreadySubmitted ? "Resubmit statement" : "Submit statement"}
        </Button>
      </div>
    </div>
  );
}

export { getEsrsStandard };
