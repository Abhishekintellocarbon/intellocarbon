"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Leaf, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ResultsPanel } from "@/components/intellocalc/results-panel";
import { LeadCaptureModal } from "@/components/intellocalc/lead-capture-modal";
import { ScreenerDisclaimer } from "./screener-disclaimer";
import { projectScreenerApi } from "@/lib/api";
import { trackLeadCaptured } from "@/lib/analytics";
import {
  projectScreenerFormSchema,
  type ProjectScreenerFormValues,
} from "@/lib/validations/project-screener";
import type { LeadContactValues } from "@/lib/validations/intellocalc";
import {
  INDIAN_STATE_OPTIONS,
  PROJECT_STAGE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  SCALE_BAND_OPTIONS,
} from "@/lib/project-screener-constants";
import type { ProjectScreenerInputs, ProjectScreenerResults, RegistryTrack } from "@/lib/project-screener-types";

const TRACK_STYLE: Record<RegistryTrack, string> = {
  DOMESTIC_ICM: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  INTERNATIONAL: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  EITHER: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  UNDETERMINED: "border-surface-border bg-surface-raised text-muted-foreground",
};

export function ProjectScreenerTool() {
  const [pendingInputs, setPendingInputs] = useState<ProjectScreenerInputs | null>(null);
  const [results, setResults] = useState<ProjectScreenerResults | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectScreenerFormValues>({ resolver: zodResolver(projectScreenerFormSchema) });

  const onScreen = (data: ProjectScreenerFormValues) => {
    setPendingInputs({
      projectType: data.projectType,
      state: data.state,
      scaleBand: data.scaleBand,
      stage: data.stage,
      projectDescription: data.projectDescription || undefined,
    });
  };

  const submitLead = async (contact: LeadContactValues) => {
    if (!pendingInputs) return;
    const { results } = await projectScreenerApi.submit(
      { ...contact, phone: contact.phone || undefined },
      pendingInputs,
    );
    // After the await, so the goal only counts leads that actually persisted —
    // a rejected request throws above and is reported by the modal instead.
    trackLeadCaptured("PROJECT_SCREENER");
    setResults(results);
    setPendingInputs(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Your project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Four questions. The screening is indicative and is not an eligibility determination.
        </p>

        <form onSubmit={handleSubmit(onScreen)} noValidate className="mt-5 space-y-4">
          <div>
            <Label htmlFor="projectType">Project type</Label>
            <Select id="projectType" {...register("projectType")} error={Boolean(errors.projectType)}>
              <option value="">Select project type</option>
              {PROJECT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.projectType?.message} />
          </div>

          <div>
            <Label htmlFor="state">Project location (state)</Label>
            <Select id="state" {...register("state")} error={Boolean(errors.state)}>
              <option value="">Select state or union territory</option>
              {INDIAN_STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <FieldError message={errors.state?.message} />
          </div>

          <div>
            <Label htmlFor="scaleBand">Estimated scale</Label>
            <Select id="scaleBand" {...register("scaleBand")} error={Boolean(errors.scaleBand)}>
              <option value="">Select estimated scale</option>
              {SCALE_BAND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Bands rather than an exact figure — units differ by project type, and this only informs whether a
              project is likely to stand alone or suit a grouped registration.
            </p>
            <FieldError message={errors.scaleBand?.message} />
          </div>

          <div>
            <Label htmlFor="stage">Current project stage</Label>
            <Select id="stage" {...register("stage")} error={Boolean(errors.stage)}>
              <option value="">Select current stage</option>
              {PROJECT_STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.stage?.message} />
          </div>

          <div>
            <Label htmlFor="projectDescription">Project details (optional)</Label>
            <textarea
              id="projectDescription"
              rows={3}
              placeholder="Anything that would help us understand the activity — especially if you selected 'Other'."
              {...register("projectDescription")}
              className={cn(
                "mt-1.5 w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20",
                errors.projectDescription ? "border-danger" : "border-surface-border",
              )}
            />
            <FieldError message={errors.projectDescription?.message} />
          </div>

          <Button type="submit" className="w-full">
            Screen this project
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
        {results ? (
          <>
            <ResultsPanel>
              <h2 className="text-lg font-semibold">Indicative screening result</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Indicative only — not an eligibility determination.
              </p>

              {/* (a) Registry framework fit */}
              <div className="mt-5 border-t border-surface-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Factory className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">Likely registry track</h3>
                </div>
                <span
                  className={cn(
                    "mt-2.5 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                    TRACK_STYLE[results.registryFit.track],
                  )}
                >
                  {results.registryFit.label}
                </span>
                <p className="mt-2.5 text-sm text-muted-foreground">{results.registryFit.rationale}</p>
                {results.registryFit.candidates.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {results.registryFit.candidates.map((candidate) => (
                      <li key={candidate} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                        {candidate}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* (b) VCM quadrant */}
              <div className="mt-5 border-t border-surface-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Leaf className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-semibold text-foreground">Likely market category</h3>
                </div>
                {results.category ? (
                  <>
                    <p className="mt-2.5 text-xl font-semibold text-foreground">{results.category.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {results.category.mitigationType === "REMOVAL" ? "Removal" : "Avoidance"} ·{" "}
                      {results.category.interventionType === "NATURE_BASED" ? "Nature-based" : "Engineered"}
                    </p>
                    <p className="mt-2.5 text-sm text-muted-foreground">{results.category.rationale}</p>
                  </>
                ) : (
                  // "Other" never gets guessed into a quadrant.
                  <p className="mt-2.5 text-sm text-muted-foreground">
                    Not determinable from the project type given. The four market categories — avoidance or
                    removal, nature-based or engineered — follow from the specific activity, so an unlisted
                    project type cannot be placed without knowing what it does.
                  </p>
                )}
              </div>

              {/* What to check next */}
              <div className="mt-5 border-t border-surface-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">What to check next</h3>
                <div className="mt-3 space-y-3.5">
                  {results.considerations.map((item) => (
                    <div key={item.heading}>
                      <p className="text-sm font-medium text-foreground">{item.heading}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-5 border-t border-surface-border pt-4 text-[11px] text-muted">
                {results.methodologyNote}
              </p>
            </ResultsPanel>

            <ScreenerDisclaimer />
          </>
        ) : (
          <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Leaf className="h-5 w-5 text-teal-500" />
            </span>
            <h2 className="mt-3.5 text-base font-medium text-foreground">Your screening appears here</h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Answer the questions on the left to see which registry track and which of the four voluntary market
              categories your project is likely to fall into.
            </p>
          </Card>
        )}
      </div>

      {/* Opens on "Screen this project", before the result is shown — the same
          point the IntelloCalc tools gate on, so the flow is consistent across
          every public tool. The modal captures name, company, email (all
          required) and phone (optional); the wording below is the one thing
          scoped to this page, and it asks for the phone number explicitly
          because a project screening is a conversation, not a one-off number.
          Phone stays optional in the shared schema — making it required here
          would change it for the three IntelloCalc tools too. */}
      <LeadCaptureModal
        open={pendingInputs !== null}
        onClose={() => setPendingInputs(null)}
        title="Where should we send this?"
        description="Your indicative screening appears right after this. Add a phone number if you'd like someone to talk the result through with you — otherwise we'll follow up by email."
        ctaLabel="Show my screening"
        onSubmit={submitLead}
      />
    </div>
  );
}
