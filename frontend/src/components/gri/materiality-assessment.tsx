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
import { MaterialityMatrix } from "@/components/gri/materiality-matrix";
import {
  GRI_TOPICS,
  GRI_IMPACT_TYPES,
  GRI_VALUE_CHAIN_LOCATIONS,
  isNegativeImpact,
  isPotentialImpact,
} from "@/lib/gri-standards";
import { griMaterialityCompleteSchema, type GriImpactFormValues } from "@/lib/validations/gri";
import { previewSignificance, previewRankings } from "@/lib/gri-scoring";
import { griApi, ApiError } from "@/lib/api";
import type { GriMaterialityAssessment, GriTopicRanking } from "@/lib/types";

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const SUGGESTED_STAKEHOLDERS = [
  "Employees",
  "Contractors",
  "Local communities",
  "Customers",
  "Suppliers",
  "Regulators",
  "Investors",
  "Trade unions",
  "Civil society",
];

const STEPS = ["Stakeholders", "Impacts", "Scoring", "Result"] as const;
type Step = 0 | 1 | 2 | 3;

const emptyImpact = (): GriImpactFormValues => ({
  topicCode: GRI_TOPICS[0].code,
  description: "",
  impactType: "NEGATIVE_ACTUAL",
  valueChainLocation: "OWN_OPERATIONS",
  scale: 3,
  scope: 3,
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
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </Select>
  );
}

export function MaterialityAssessment({
  facilityId,
  reportingPeriod,
  existing,
  existingRankings,
}: {
  facilityId: string;
  reportingPeriod: string;
  existing?: GriMaterialityAssessment | null;
  existingRankings?: GriTopicRanking[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedRankings, setSavedRankings] = useState<GriTopicRanking[] | null>(existingRankings ?? null);

  const [stakeholders, setStakeholders] = useState<string[]>(existing?.stakeholderGroups ?? []);
  const [customStakeholder, setCustomStakeholder] = useState("");
  const [engagement, setEngagement] = useState(existing?.stakeholderEngagementApproach ?? "");
  const [identification, setIdentification] = useState(existing?.impactIdentificationProcess ?? "");
  const [prioritisation, setPrioritisation] = useState(existing?.prioritisationProcess ?? "");
  const [threshold, setThreshold] = useState(existing?.materialityThreshold ?? 3);
  const [impacts, setImpacts] = useState<GriImpactFormValues[]>(
    existing?.impacts?.map((i) => ({
      topicCode: i.topicCode,
      description: i.description,
      impactType: i.impactType,
      valueChainLocation: i.valueChainLocation,
      scale: i.scale,
      scope: i.scope,
      irremediability: i.irremediability ?? undefined,
      likelihood: i.likelihood ?? undefined,
    })) ?? [],
  );

  const isCompleted = existing?.completedAt != null;

  const buildPayload = () => ({
    reportingPeriod,
    stakeholderGroups: stakeholders,
    stakeholderEngagementApproach: engagement || undefined,
    impactIdentificationProcess: identification || undefined,
    prioritisationProcess: prioritisation || undefined,
    materialityThreshold: threshold,
    impacts: impacts.map((i) => ({
      ...i,
      // Strip attributes that don't apply to this impact type — the backend
      // rejects an irremediability on a positive impact outright, and a value
      // left over from switching the type would otherwise fail the save.
      irremediability: isNegativeImpact(i.impactType) ? i.irremediability : undefined,
      likelihood: isPotentialImpact(i.impactType) ? i.likelihood : undefined,
    })),
  });

  const saveDraft = async () => {
    setSaving(true);
    setServerError(null);
    try {
      await griApi.saveMateriality(facilityId, buildPayload(), false);
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

    const parsed = griMaterialityCompleteSchema.safeParse(buildPayload());
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(errors);
      setServerError("Fix the highlighted fields before completing the assessment.");
      // Send the user back to the step that owns the first problem.
      const firstPath = parsed.error.issues[0]?.path[0];
      if (firstPath === "impactIdentificationProcess" || firstPath === "prioritisationProcess") setStep(0);
      else if (firstPath === "impacts") setStep(1);
      return;
    }

    setSaving(true);
    try {
      const { rankings } = await griApi.saveMateriality(facilityId, buildPayload(), true);
      setSavedRankings(rankings);
      setStep(3);
      router.refresh();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't complete the assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateImpact = (index: number, patch: Partial<GriImpactFormValues>) => {
    setImpacts((prev) => prev.map((impact, i) => (i === index ? { ...impact, ...patch } : impact)));
  };

  const rankings = savedRankings ?? previewRankings(impacts, threshold);
  const materialCount = rankings.filter((r) => "meetsThreshold" in r && r.meetsThreshold).length;

  return (
    // Not a <form>. A multi-step flow whose Continue and Complete buttons swap
    // in the same position is exactly the shape that has previously caused an
    // early submit here, so the actions are plain buttons with explicit
    // handlers and distinct keys (see the step footer below).
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
          This assessment has already been completed. GRI expects material topics to be reviewed each reporting
          period — re-running it will recalculate which Topic Standards apply. Existing management-approach narrative
          is preserved.
        </Alert>
      )}

      {/* --- Step 1: Stakeholders and process (GRI 3-1) --- */}
      {step === 0 && (
        <Card className="p-6">
          <h2 className="font-medium">Stakeholders and process</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            GRI 3-1 requires you to describe how impacts were identified and prioritised, and who was engaged.
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
                    onClick={() =>
                      setStakeholders((prev) => (active ? prev.filter((s) => s !== name) : [...prev, name]))
                    }
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
                    onClick={() => setStakeholders((prev) => prev.filter((s) => s !== name))}
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
                  if (name && !stakeholders.includes(name)) setStakeholders((prev) => [...prev, name]);
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
              <textarea
                id="engagement"
                rows={3}
                className={textareaClass}
                value={engagement}
                onChange={(e) => setEngagement(e.target.value)}
                placeholder="Workshops, interviews, surveys, works-council meetings..."
              />
            </div>
            <div>
              <Label htmlFor="identification">How actual and potential impacts were identified</Label>
              <textarea
                id="identification"
                rows={3}
                className={textareaClass}
                value={identification}
                onChange={(e) => setIdentification(e.target.value)}
                placeholder="Required before the assessment can be completed."
              />
              <FieldError message={fieldErrors.impactIdentificationProcess} />
            </div>
            <div>
              <Label htmlFor="prioritisation">How impacts were prioritised</Label>
              <textarea
                id="prioritisation"
                rows={3}
                className={textareaClass}
                value={prioritisation}
                onChange={(e) => setPrioritisation(e.target.value)}
                placeholder="Who scored the impacts, and how the result was validated."
              />
              <FieldError message={fieldErrors.prioritisationProcess} />
            </div>
          </div>
        </Card>
      )}

      {/* --- Step 2: Impacts --- */}
      {step === 1 && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Actual and potential impacts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                List the impacts your operations have on the economy, environment and people. Each one is assigned to
                the GRI Topic Standard it belongs to.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setImpacts((p) => [...p, emptyImpact()])}>
              <Plus className="h-3.5 w-3.5" />
              Add impact
            </Button>
          </div>

          <FieldError message={fieldErrors.impacts} />

          <div className="mt-5 space-y-4">
            {impacts.length === 0 && (
              <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-muted-foreground">
                No impacts yet. Add at least one to continue.
              </p>
            )}
            {impacts.map((impact, i) => (
              <div key={i} className="rounded-xl border border-surface-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">Impact {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setImpacts((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-danger"
                    aria-label={`Remove impact ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>GRI topic</Label>
                    <Select value={impact.topicCode} onChange={(e) => updateImpact(i, { topicCode: e.target.value })}>
                      {GRI_TOPICS.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label} — {t.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={impact.impactType}
                      onChange={(e) =>
                        updateImpact(i, {
                          impactType: e.target.value as GriImpactFormValues["impactType"],
                          // Clearing the now-inapplicable attributes keeps the
                          // preview score honest and the payload valid.
                          irremediability: isNegativeImpact(e.target.value) ? impact.irremediability : undefined,
                          likelihood: isPotentialImpact(e.target.value) ? impact.likelihood : undefined,
                        })
                      }
                    >
                      {GRI_IMPACT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="mt-3">
                  <Label>Description</Label>
                  <textarea
                    rows={2}
                    className={textareaClass}
                    value={impact.description}
                    onChange={(e) => updateImpact(i, { description: e.target.value })}
                    placeholder="What the impact is, and on whom."
                  />
                  <FieldError message={fieldErrors[`impacts.${i}.description`]} />
                </div>

                <div className="mt-3">
                  <Label>Where in the value chain</Label>
                  <Select
                    value={impact.valueChainLocation}
                    onChange={(e) =>
                      updateImpact(i, {
                        valueChainLocation: e.target.value as GriImpactFormValues["valueChainLocation"],
                      })
                    }
                  >
                    {GRI_VALUE_CHAIN_LOCATIONS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* --- Step 3: Scoring --- */}
      {step === 2 && (
        <Card className="p-6">
          <h2 className="font-medium">Score each impact</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            All attributes are 1-5. For negative impacts, significance is severity — scale, scope and
            irremediability. For positive impacts, irremediability does not apply. Likelihood applies only to impacts
            that could occur, and discounts the score by at most 40% so it can never on its own remove a severe
            impact from the report.
          </p>

          <div className="mt-5 max-w-xs">
            <Label htmlFor="threshold">Materiality threshold</Label>
            <Input
              id="threshold"
              inputMode="decimal"
              value={String(threshold)}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Topics scoring at or above this become material. GRI requires the threshold to be disclosed.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {impacts.map((impact, i) => {
              const negative = isNegativeImpact(impact.impactType);
              const potential = isPotentialImpact(impact.impactType);
              const score = previewSignificance(impact);
              const topic = GRI_TOPICS.find((t) => t.code === impact.topicCode);
              return (
                <div key={i} className="rounded-xl border border-surface-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground">{topic?.label}</span> {impact.description || "(no description)"}
                    </p>
                    <span
                      className={
                        score >= threshold
                          ? "rounded-full bg-teal-500/15 px-2.5 py-1 text-xs font-semibold text-teal-500"
                          : "rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {score.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <Label>Scale</Label>
                      <RatingSelect value={impact.scale} onChange={(v) => updateImpact(i, { scale: v ?? 1 })} />
                    </div>
                    <div>
                      <Label>Scope</Label>
                      <RatingSelect value={impact.scope} onChange={(v) => updateImpact(i, { scope: v ?? 1 })} />
                    </div>
                    <div>
                      <Label>Irremediability</Label>
                      <RatingSelect
                        value={negative ? impact.irremediability : undefined}
                        disabled={!negative}
                        onChange={(v) => updateImpact(i, { irremediability: v })}
                      />
                      {!negative && <p className="mt-1 text-[11px] text-muted">Negative impacts only</p>}
                    </div>
                    <div>
                      <Label>Likelihood</Label>
                      <RatingSelect
                        value={potential ? impact.likelihood : undefined}
                        disabled={!potential}
                        onChange={(v) => updateImpact(i, { likelihood: v })}
                      />
                      {!potential && <p className="mt-1 text-[11px] text-muted">Potential impacts only</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium">Materiality matrix</h3>
            <div className="mt-3">
              <MaterialityMatrix impacts={impacts} threshold={threshold} />
            </div>
          </div>
        </Card>
      )}

      {/* --- Step 4: Result --- */}
      {step === 3 && (
        <Card className="p-6">
          <h2 className="font-medium">Material topics</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {savedRankings
              ? "These topics are now active in the disclosure module. Topics below the threshold are recorded as assessed and excluded, with a rationale, as GRI requires."
              : "Preview only — complete the assessment to activate these topics."}
          </p>

          <div className="mt-4 rounded-xl bg-surface-raised/60 p-4">
            <p className="text-2xl font-semibold">
              {materialCount} <span className="text-base font-normal text-muted-foreground">of {GRI_TOPICS.length} topics material</span>
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {GRI_TOPICS.map((topic) => {
              const ranking = rankings.find((r) => r.topicCode === topic.code);
              const material = ranking ? ranking.meetsThreshold : false;
              return (
                <div
                  key={topic.code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground">{topic.label}</span> {topic.title}
                    </p>
                    {!material && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ranking
                          ? `Scored ${ranking.significanceScore.toFixed(2)}, below the threshold of ${threshold.toFixed(2)}.`
                          : "No impacts identified for this topic."}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      material
                        ? "shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500"
                        : "shrink-0 rounded-full border border-surface-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {material ? `Material${ranking ? ` · ${ranking.significanceScore.toFixed(2)}` : ""}` : "Not material"}
                  </span>
                </div>
              );
            })}
          </div>

          {savedRankings && (
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => router.push(`/facilities/${facilityId}/gri/${encodeURIComponent(reportingPeriod)}/edit`)}>
                Continue to disclosures
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Step footer. The forward action is a Continue on steps 0-1 and a
          Complete on step 2 — two different buttons occupying the same slot.
          They carry distinct `key`s so React mounts a fresh node instead of
          reusing the previous one, which is what previously let a click land
          on the wrong handler. */}
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
