"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { DoubleMaterialityMatrix } from "@/components/csrd/double-materiality-matrix";
import {
  ESRS_STANDARDS,
  CSRD_IRO_KINDS,
  CSRD_IMPACT_TYPES,
  CSRD_FINANCIAL_EFFECT_TYPES,
  CSRD_VALUE_CHAIN_LOCATIONS,
  getEsrsStandard,
  isNegativeImpact,
  isPotentialImpact,
} from "@/lib/esrs-standards";
import { previewImpactScore, previewFinancialScore, previewScores } from "@/lib/csrd-scoring";
import { csrdMaterialityCompleteSchema, type CsrdIroFormValues } from "@/lib/validations/csrd";
import { csrdApi, ApiError } from "@/lib/api";
import type { CsrdMaterialityAssessment, CsrdStandardScore } from "@/lib/types";

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const SUGGESTED_STAKEHOLDERS = [
  "Employees",
  "Workers in the value chain",
  "Affected communities",
  "Consumers and end-users",
  "Suppliers",
  "Investors and lenders",
  "Regulators",
  "Business partners",
];

const STEPS = ["Process", "Matters", "Scoring", "Result"] as const;
type Step = 0 | 1 | 2 | 3;

const emptyIro = (): CsrdIroFormValues => ({
  standardCode: ESRS_STANDARDS[0].code,
  description: "",
  kind: "BOTH",
  valueChainLocation: "OWN_OPERATIONS",
  impactType: "NEGATIVE_ACTUAL",
  scale: 3,
  scope: 3,
  financialEffectType: "RISK",
  magnitude: 3,
});

function RatingSelect({
  value,
  onChange,
  disabled,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value == null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    >
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </Select>
  );
}

export function DoubleMaterialityAssessment({
  facilityId,
  reportingPeriod,
  existing,
  existingScores,
}: {
  facilityId: string;
  reportingPeriod: string;
  existing?: CsrdMaterialityAssessment | null;
  existingScores?: CsrdStandardScore[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedScores, setSavedScores] = useState<CsrdStandardScore[] | null>(existingScores ?? null);

  const [stakeholders, setStakeholders] = useState<string[]>(existing?.stakeholderGroups ?? []);
  const [customStakeholder, setCustomStakeholder] = useState("");
  const [engagement, setEngagement] = useState(existing?.engagementApproach ?? "");
  const [identification, setIdentification] = useState(existing?.iroIdentificationProcess ?? "");
  const [prioritisation, setPrioritisation] = useState(existing?.prioritisationProcess ?? "");
  const [impactThreshold, setImpactThreshold] = useState(existing?.impactThreshold ?? 3);
  const [financialThreshold, setFinancialThreshold] = useState(existing?.financialThreshold ?? 3);
  const [iros, setIros] = useState<CsrdIroFormValues[]>(
    existing?.iros?.map((i) => ({
      standardCode: i.standardCode,
      description: i.description,
      kind: i.kind,
      valueChainLocation: i.valueChainLocation,
      impactType: i.impactType ?? undefined,
      scale: i.scale ?? undefined,
      scope: i.scope ?? undefined,
      irremediability: i.irremediability ?? undefined,
      impactLikelihood: i.impactLikelihood ?? undefined,
      financialEffectType: i.financialEffectType ?? undefined,
      magnitude: i.magnitude ?? undefined,
      financialLikelihood: i.financialLikelihood ?? undefined,
    })) ?? [],
  );

  const isCompleted = existing?.completedAt != null;

  const buildPayload = () => ({
    reportingPeriod,
    stakeholderGroups: stakeholders,
    engagementApproach: engagement || undefined,
    iroIdentificationProcess: identification || undefined,
    prioritisationProcess: prioritisation || undefined,
    impactThreshold,
    financialThreshold,
    iros: iros.map((i) => {
      const onImpact = i.kind !== "FINANCIAL";
      const onFinancial = i.kind !== "IMPACT";
      // Attributes for an axis the entry is not scored on are stripped — the
      // backend rejects an irremediability on a positive impact outright, and
      // a value left over from switching kind or type would fail the save.
      return {
        ...i,
        impactType: onImpact ? i.impactType : undefined,
        scale: onImpact ? i.scale : undefined,
        scope: onImpact ? i.scope : undefined,
        irremediability: onImpact && i.impactType && isNegativeImpact(i.impactType) ? i.irremediability : undefined,
        impactLikelihood: onImpact && i.impactType && isPotentialImpact(i.impactType) ? i.impactLikelihood : undefined,
        financialEffectType: onFinancial ? i.financialEffectType : undefined,
        magnitude: onFinancial ? i.magnitude : undefined,
        financialLikelihood: onFinancial ? i.financialLikelihood : undefined,
      };
    }),
  });

  const saveDraft = async () => {
    setSaving(true);
    setServerError(null);
    try {
      await csrdApi.saveMateriality(facilityId, buildPayload(), false);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    await saveDraft();
    setStep((s) => Math.min(3, s + 1) as Step);
  };

  const complete = async () => {
    setServerError(null);
    setFieldErrors({});

    const parsed = csrdMaterialityCompleteSchema.safeParse(buildPayload());
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[issue.path.join(".")] = issue.message;
      setFieldErrors(errors);
      setServerError("Fix the highlighted fields before completing the assessment.");
      const first = parsed.error.issues[0]?.path[0];
      if (first === "iroIdentificationProcess" || first === "prioritisationProcess") setStep(0);
      else if (first === "iros") setStep(1);
      return;
    }

    setSaving(true);
    try {
      const { scores } = await csrdApi.saveMateriality(facilityId, buildPayload(), true);
      setSavedScores(scores);
      setStep(3);
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't complete the assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateIro = (index: number, patch: Partial<CsrdIroFormValues>) => {
    setIros((prev) => prev.map((iro, i) => (i === index ? { ...iro, ...patch } : iro)));
  };

  const scores = savedScores ?? previewScores(iros, impactThreshold, financialThreshold);
  const materialCount = scores.filter((s) => s.isMaterial).length;

  return (
    // Not a <form>. A multi-step flow whose Continue and Complete buttons swap
    // in the same position is the shape that has previously caused an early
    // submit in this codebase, so every action is a plain button with an
    // explicit handler and the mutually-exclusive ones carry distinct keys.
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={
                  i === step
                    ? "flex items-center gap-1.5 rounded-full bg-teal-500/15 px-3 py-1 font-semibold text-teal-500"
                    : i < step
                      ? "flex items-center gap-1.5 rounded-full px-3 py-1 text-muted-foreground"
                      : "flex items-center gap-1.5 rounded-full px-3 py-1 text-muted"
                }
              >
                {i < step && <Check className="h-3 w-3" />}
                {i + 1}. {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted" />}
            </li>
          ))}
        </ol>
        {isCompleted && (
          <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
            Completed
          </span>
        )}
      </div>

      {serverError && <Alert variant="error">{serverError}</Alert>}

      {isCompleted && step === 0 && (
        <Alert variant="info">
          This assessment has already been completed. ESRS expects it to be revisited each reporting period —
          re-running it recalculates which standards apply. Existing minimum-disclosure narrative is preserved.
        </Alert>
      )}

      {/* --- Step 1: process --- */}
      {step === 0 && (
        <Card className="p-6">
          <h2 className="font-medium">Process and stakeholders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ESRS 2 IRO-1 requires you to describe how impacts, risks and opportunities were identified and
            prioritised, and who was engaged.
          </p>

          <div className="mt-5">
            <Label>Stakeholder groups engaged</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED_STAKEHOLDERS.map((name) => {
                const active = stakeholders.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setStakeholders((p) => (active ? p.filter((s) => s !== name) : [...p, name]))}
                    className={
                      active
                        ? "rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-500"
                        : "rounded-full border border-surface-border px-3 py-1.5 text-xs text-muted-foreground hover:border-teal-500/40"
                    }
                  >
                    {name}
                  </button>
                );
              })}
              {stakeholders
                .filter((s) => !SUGGESTED_STAKEHOLDERS.includes(s))
                .map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setStakeholders((p) => p.filter((s) => s !== name))}
                    className="rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-500"
                  >
                    {name} ×
                  </button>
                ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Add another stakeholder group"
                value={customStakeholder}
                onChange={(e) => setCustomStakeholder(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const name = customStakeholder.trim();
                  if (name && !stakeholders.includes(name)) setStakeholders((p) => [...p, name]);
                  setCustomStakeholder("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="engagement">How stakeholders were engaged</Label>
              <textarea id="engagement" rows={3} className={textareaClass} value={engagement} onChange={(e) => setEngagement(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="identification">How impacts, risks and opportunities were identified</Label>
              <textarea
                id="identification"
                rows={3}
                className={textareaClass}
                value={identification}
                onChange={(e) => setIdentification(e.target.value)}
                placeholder="Required before the assessment can be completed."
              />
              <FieldError message={fieldErrors.iroIdentificationProcess} />
            </div>
            <div>
              <Label htmlFor="prioritisation">How they were prioritised</Label>
              <textarea
                id="prioritisation"
                rows={3}
                className={textareaClass}
                value={prioritisation}
                onChange={(e) => setPrioritisation(e.target.value)}
              />
              <FieldError message={fieldErrors.prioritisationProcess} />
            </div>
          </div>
        </Card>
      )}

      {/* --- Step 2: matters --- */}
      {step === 1 && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Impacts, risks and opportunities</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Each matter is assigned to the ESRS standard it belongs to, and assessed on impact materiality,
                financial materiality, or both.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIros((p) => [...p, emptyIro()])}>
              <Plus className="h-3.5 w-3.5" />
              Add matter
            </Button>
          </div>

          <FieldError message={fieldErrors.iros} />

          <div className="mt-5 space-y-4">
            {iros.length === 0 && (
              <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-muted-foreground">
                No matters yet. Add at least one to continue.
              </p>
            )}
            {iros.map((iro, i) => (
              <div key={i} className="rounded-xl border border-surface-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">Matter {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setIros((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-danger"
                    aria-label={`Remove matter ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>ESRS standard</Label>
                    <Select value={iro.standardCode} onChange={(e) => updateIro(i, { standardCode: e.target.value })}>
                      {ESRS_STANDARDS.map((s) => (
                        <option key={s.code} value={s.code}>{s.label} — {s.title}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Assessed on</Label>
                    <Select
                      value={iro.kind}
                      onChange={(e) => updateIro(i, { kind: e.target.value as CsrdIroFormValues["kind"] })}
                    >
                      {CSRD_IRO_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="mt-3">
                  <Label>Description</Label>
                  <textarea
                    rows={2}
                    className={textareaClass}
                    value={iro.description}
                    onChange={(e) => updateIro(i, { description: e.target.value })}
                    placeholder="What the matter is, and who or what it affects."
                  />
                  <FieldError message={fieldErrors[`iros.${i}.description`]} />
                </div>

                <div className="mt-3">
                  <Label>Where in the value chain</Label>
                  <Select
                    value={iro.valueChainLocation}
                    onChange={(e) =>
                      updateIro(i, { valueChainLocation: e.target.value as CsrdIroFormValues["valueChainLocation"] })
                    }
                  >
                    {CSRD_VALUE_CHAIN_LOCATIONS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* --- Step 3: scoring --- */}
      {step === 2 && (
        <Card className="p-6">
          <h2 className="font-medium">Score each matter</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            All attributes are 1-5. Impact materiality is severity — scale, scope and, for negative impacts,
            irremediability — weighted by likelihood where the impact has not yet occurred. Financial materiality is
            the magnitude of the financial effect weighted by the likelihood it materialises. A standard becomes
            material if it clears the threshold on <span className="font-medium text-foreground">either</span> axis.
          </p>

          <div className="mt-5 grid max-w-md grid-cols-2 gap-4">
            <div>
              <Label htmlFor="impactThreshold">Impact threshold</Label>
              <Input
                id="impactThreshold"
                inputMode="decimal"
                value={String(impactThreshold)}
                onChange={(e) => setImpactThreshold(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="financialThreshold">Financial threshold</Label>
              <Input
                id="financialThreshold"
                inputMode="decimal"
                value={String(financialThreshold)}
                onChange={(e) => setFinancialThreshold(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Both thresholds are disclosed in the statement.</p>

          <div className="mt-5 space-y-3">
            {iros.map((iro, i) => {
              const onImpact = iro.kind !== "FINANCIAL";
              const onFinancial = iro.kind !== "IMPACT";
              const negative = iro.impactType != null && isNegativeImpact(iro.impactType);
              const potential = iro.impactType != null && isPotentialImpact(iro.impactType);
              const impactScore = previewImpactScore(iro);
              const financialScore = previewFinancialScore(iro);
              const standard = getEsrsStandard(iro.standardCode);
              const material =
                (impactScore != null && impactScore >= impactThreshold) ||
                (financialScore != null && financialScore >= financialThreshold);

              return (
                <div key={i} className="rounded-xl border border-surface-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground">{standard?.label}</span>{" "}
                      {iro.description || "(no description)"}
                    </p>
                    <span
                      className={
                        material
                          ? "rounded-full bg-teal-500/15 px-2.5 py-1 text-xs font-semibold text-teal-500"
                          : "rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {impactScore != null ? `I ${impactScore.toFixed(2)}` : "I —"} ·{" "}
                      {financialScore != null ? `F ${financialScore.toFixed(2)}` : "F —"}
                    </span>
                  </div>

                  {onImpact && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Impact materiality
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div className="col-span-2 sm:col-span-1">
                          <Label>Type</Label>
                          <Select
                            value={iro.impactType ?? ""}
                            onChange={(e) =>
                              updateIro(i, {
                                impactType: e.target.value as CsrdIroFormValues["impactType"],
                                irremediability: isNegativeImpact(e.target.value) ? iro.irremediability : undefined,
                                impactLikelihood: isPotentialImpact(e.target.value) ? iro.impactLikelihood : undefined,
                              })
                            }
                          >
                            {CSRD_IMPACT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label>Scale</Label>
                          <RatingSelect value={iro.scale} onChange={(v) => updateIro(i, { scale: v })} />
                        </div>
                        <div>
                          <Label>Scope</Label>
                          <RatingSelect value={iro.scope} onChange={(v) => updateIro(i, { scope: v })} />
                        </div>
                        <div>
                          <Label>Irremediability</Label>
                          <RatingSelect
                            value={negative ? iro.irremediability : undefined}
                            disabled={!negative}
                            onChange={(v) => updateIro(i, { irremediability: v })}
                          />
                          {!negative && <p className="mt-1 text-[11px] text-muted">Negative only</p>}
                        </div>
                        <div>
                          <Label>Likelihood</Label>
                          <RatingSelect
                            value={potential ? iro.impactLikelihood : undefined}
                            disabled={!potential}
                            onChange={(v) => updateIro(i, { impactLikelihood: v })}
                          />
                          {!potential && <p className="mt-1 text-[11px] text-muted">Potential only</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {onFinancial && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Financial materiality
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <Label>Effect</Label>
                          <Select
                            value={iro.financialEffectType ?? ""}
                            onChange={(e) =>
                              updateIro(i, {
                                financialEffectType: e.target.value as CsrdIroFormValues["financialEffectType"],
                              })
                            }
                          >
                            {CSRD_FINANCIAL_EFFECT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label>Magnitude</Label>
                          <RatingSelect value={iro.magnitude} onChange={(v) => updateIro(i, { magnitude: v })} />
                        </div>
                        <div>
                          <Label>Likelihood</Label>
                          <RatingSelect
                            value={iro.financialLikelihood}
                            onChange={(v) => updateIro(i, { financialLikelihood: v })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium">Double materiality matrix</h3>
            <div className="mt-3">
              <DoubleMaterialityMatrix
                iros={iros}
                impactThreshold={impactThreshold}
                financialThreshold={financialThreshold}
              />
            </div>
          </div>
        </Card>
      )}

      {/* --- Step 4: result --- */}
      {step === 3 && (
        <Card className="p-6">
          <h2 className="font-medium">Material ESRS standards</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {savedScores
              ? "These standards are now active in the disclosure module. Standards below both thresholds are recorded as assessed and excluded, with a rationale, as ESRS requires."
              : "Preview only — complete the assessment to activate these standards."}
          </p>

          <div className="mt-4 rounded-xl bg-surface-raised/60 p-4">
            <p className="text-2xl font-semibold">
              {materialCount}{" "}
              <span className="text-base font-normal text-muted-foreground">of {ESRS_STANDARDS.length} standards material</span>
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {ESRS_STANDARDS.map((standard) => {
              const score = scores.find((s) => s.standardCode === standard.code);
              const material = score?.isMaterial ?? false;
              const via =
                score?.impactMaterial && score?.financialMaterial
                  ? "impact and financial"
                  : score?.impactMaterial
                    ? "impact"
                    : score?.financialMaterial
                      ? "financial"
                      : null;
              return (
                <div
                  key={standard.code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground">{standard.label}</span> {standard.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {material
                        ? `Material via ${via} materiality.`
                        : score
                          ? `Impact ${score.impactScore?.toFixed(2) ?? "—"}, financial ${score.financialScore?.toFixed(2) ?? "—"} — below both thresholds.`
                          : "No matters identified for this standard."}
                    </p>
                  </div>
                  <span
                    className={
                      material
                        ? "shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500"
                        : "shrink-0 rounded-full border border-surface-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {material ? "Material" : "Not material"}
                  </span>
                </div>
              );
            })}
          </div>

          {savedScores && (
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => router.push(`/facilities/${facilityId}/csrd/${encodeURIComponent(reportingPeriod)}/edit`)}
              >
                Continue to datapoints
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          key="back"
          type="button"
          variant="ghost"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step < 2 ? (
          <Button key="continue" type="button" onClick={goNext} isLoading={saving}>
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : step === 2 ? (
          <Button key="complete" type="button" onClick={complete} isLoading={saving}>
            <Check className="h-4 w-4" />
            Complete assessment
          </Button>
        ) : (
          <Button key="reopen" type="button" variant="secondary" onClick={() => setStep(2)}>
            <ChevronLeft className="h-4 w-4" />
            Adjust scoring
          </Button>
        )}
      </div>
    </div>
  );
}
