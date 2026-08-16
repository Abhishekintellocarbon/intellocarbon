"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { useAutosave } from "@/hooks/use-autosave";
import { GRI_TOPICS, GRI_3_3_FIELDS, type GriFormField } from "@/lib/gri-standards";
import { griApi, ApiError } from "@/lib/api";
import type { GriReport, GriMetrics, GriTopicRow } from "@/lib/types";

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const toStr = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

/**
 * Universal (GRI 2) fields, grouped by disclosure. GRI 2 is always reported in
 * full and is never materiality-gated, so unlike the topic sections this list
 * is fixed.
 */
const UNIVERSAL_GROUPS: { title: string; caption: string; fields: GriFormField[] }[] = [
  {
    title: "Organizational details",
    caption: "2-1 to 2-3",
    fields: [
      { name: "legalName", label: "Legal name", type: "text", disclosure: "2-1" },
      { name: "ownershipLegalForm", label: "Ownership and legal form", type: "text", disclosure: "2-1" },
      { name: "headquartersLocation", label: "Location of headquarters", type: "text", disclosure: "2-1" },
      { name: "countriesOfOperation", label: "Countries of operation", type: "text", disclosure: "2-1" },
      { name: "entitiesIncluded", label: "Entities included in this report", type: "text", disclosure: "2-2" },
      { name: "reportingFrequency", label: "Reporting frequency", type: "text", disclosure: "2-3" },
      { name: "contactPoint", label: "Contact point for questions", type: "text", disclosure: "2-3" },
    ],
  },
  {
    title: "Restatements and assurance",
    caption: "2-4 to 2-5",
    fields: [
      { name: "restatements", label: "Restatements of information", type: "text", disclosure: "2-4" },
      { name: "externalAssurancePolicy", label: "Policy and practice for external assurance", type: "text", disclosure: "2-5" },
      { name: "assuranceProvider", label: "Assurance provider", type: "text", disclosure: "2-5" },
      { name: "assuranceLevel", label: "Level of assurance", type: "text", disclosure: "2-5" },
    ],
  },
  {
    title: "Activities and workers",
    caption: "2-6 to 2-8",
    fields: [
      { name: "sectorsServed", label: "Sectors served", type: "text", disclosure: "2-6" },
      { name: "valueChainDescription", label: "Value chain and business relationships", type: "text", disclosure: "2-6" },
      { name: "significantChangesToValueChain", label: "Significant changes during the period", type: "text", disclosure: "2-6" },
      { name: "employeesTotal", label: "Total employees", type: "int", disclosure: "2-7" },
      { name: "employeesFemale", label: "Employees — female", type: "int", disclosure: "2-7" },
      { name: "employeesMale", label: "Employees — male", type: "int", disclosure: "2-7" },
      { name: "employeesPermanent", label: "Employees — permanent", type: "int", disclosure: "2-7" },
      { name: "employeesTemporary", label: "Employees — temporary", type: "int", disclosure: "2-7" },
      { name: "employeesFullTime", label: "Employees — full-time", type: "int", disclosure: "2-7" },
      { name: "employeesPartTime", label: "Employees — part-time", type: "int", disclosure: "2-7" },
      { name: "employeeDataMethodology", label: "Methodology and assumptions", type: "text", disclosure: "2-7" },
      { name: "nonEmployeeWorkersTotal", label: "Workers who are not employees", type: "int", disclosure: "2-8" },
      { name: "nonEmployeeWorkersDescription", label: "Description of non-employee workers", type: "text", disclosure: "2-8" },
    ],
  },
  {
    title: "Governance",
    caption: "2-9 to 2-18",
    fields: [
      { name: "governanceStructure", label: "Governance structure and composition", type: "text", disclosure: "2-9" },
      { name: "governanceCommittees", label: "Committees of the governance body", type: "text", disclosure: "2-9" },
      { name: "governanceNominationProcess", label: "Nomination and selection process", type: "text", disclosure: "2-10" },
      { name: "chairIsSeniorExecutive", label: "Chair is also a senior executive", type: "bool", disclosure: "2-11" },
      { name: "chairRoleDescription", label: "Role of the chair", type: "text", disclosure: "2-11" },
      { name: "governanceImpactOversight", label: "Oversight of the management of impacts", type: "text", disclosure: "2-12" },
      { name: "impactResponsibilityDelegation", label: "Delegation of responsibility for impacts", type: "text", disclosure: "2-13" },
      { name: "governanceReportingRole", label: "Role in sustainability reporting", type: "text", disclosure: "2-14" },
      { name: "conflictsOfInterestProcess", label: "Conflicts of interest", type: "text", disclosure: "2-15" },
      { name: "criticalConcernsProcess", label: "Communication of critical concerns", type: "text", disclosure: "2-16" },
      { name: "criticalConcernsCount", label: "Critical concerns communicated", type: "int", disclosure: "2-16" },
      { name: "governanceCollectiveKnowledge", label: "Collective knowledge of the governance body", type: "text", disclosure: "2-17" },
      { name: "governancePerformanceEvaluation", label: "Evaluation of governance body performance", type: "text", disclosure: "2-18" },
    ],
  },
  {
    title: "Remuneration",
    caption: "2-19 to 2-21",
    fields: [
      { name: "remunerationPolicies", label: "Remuneration policies", type: "text", disclosure: "2-19" },
      { name: "remunerationProcess", label: "Process to determine remuneration", type: "text", disclosure: "2-20" },
      { name: "compensationRatio", label: "Annual total compensation ratio", type: "number", disclosure: "2-21", hint: "Highest-paid individual to the median for all other employees." },
      { name: "compensationRatioIncreasePct", label: "Percentage increase in that ratio", type: "number", disclosure: "2-21" },
    ],
  },
  {
    title: "Strategy, policies and practices",
    caption: "2-22 to 2-27",
    fields: [
      { name: "sustainableDevelopmentStatement", label: "Statement on sustainable development strategy", type: "text", disclosure: "2-22" },
      { name: "policyCommitments", label: "Policy commitments", type: "text", disclosure: "2-23" },
      { name: "humanRightsPolicyCommitment", label: "Human rights policy commitment", type: "text", disclosure: "2-23" },
      { name: "policyEmbedding", label: "Embedding policy commitments", type: "text", disclosure: "2-24" },
      { name: "remediationProcesses", label: "Processes to remediate negative impacts", type: "text", disclosure: "2-25" },
      { name: "adviceAndConcernsMechanisms", label: "Mechanisms for advice and raising concerns", type: "text", disclosure: "2-26" },
      { name: "significantFinesCount", label: "Instances of non-compliance with a fine", type: "int", disclosure: "2-27" },
      { name: "significantFinesValueInr", label: "Total value of fines paid (Rs.)", type: "number", disclosure: "2-27" },
      { name: "nonMonetarySanctionsCount", label: "Instances with a non-monetary sanction", type: "int", disclosure: "2-27" },
      { name: "complianceIncidentsDescription", label: "Description of non-compliance", type: "text", disclosure: "2-27" },
    ],
  },
  {
    title: "Stakeholders",
    caption: "2-28 to 2-30",
    fields: [
      { name: "membershipAssociations", label: "Membership associations", type: "text", disclosure: "2-28" },
      { name: "stakeholderEngagementApproach", label: "Approach to stakeholder engagement", type: "text", disclosure: "2-29" },
      { name: "collectiveBargainingCoveragePct", label: "Employees covered by collective bargaining (%)", type: "pct", disclosure: "2-30" },
      { name: "collectiveBargainingDescription", label: "Collective bargaining agreements", type: "text", disclosure: "2-30" },
    ],
  },
];

const inputModeFor = (type: GriFormField["type"]) =>
  type === "int" || type === "year" ? "numeric" : "decimal";

export function GriDisclosureForm({
  facilityId,
  reportingPeriod,
  report,
  metrics,
}: {
  facilityId: string;
  reportingPeriod: string;
  report: GriReport;
  metrics: GriMetrics | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAlreadySubmitted = report.status === "SUBMITTED";

  // Plain controlled state rather than react-hook-form: the field set is
  // driven by the registry and by which topics are material, so it is not
  // known at mount and changes when the materiality assessment is re-run.
  const [turnoverInr, setTurnoverInr] = useState(toStr(report.turnoverInr));
  const [notes, setNotes] = useState(report.notes ?? "");
  const [universal, setUniversal] = useState<Record<string, string>>(() => {
    const row = (report.universalDisclosures ?? {}) as GriTopicRow;
    const out: Record<string, string> = {};
    for (const group of UNIVERSAL_GROUPS) {
      for (const field of group.fields) out[field.name] = toStr(row[field.name]);
    }
    return out;
  });

  const materialTopics = GRI_TOPICS.filter(
    (topic) => report.materialTopics.find((t) => t.topicCode === topic.code)?.isMaterial,
  );
  const excludedTopics = GRI_TOPICS.filter(
    (topic) => report.materialTopics.find((t) => t.topicCode === topic.code)?.isMaterial === false,
  );

  const [managementApproach, setManagementApproach] = useState<Record<string, Record<string, string>>>(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const topic of materialTopics) {
      const record = report.materialTopics.find((t) => t.topicCode === topic.code);
      out[topic.code] = Object.fromEntries(
        GRI_3_3_FIELDS.map((f) => [f.name, toStr((record as unknown as Record<string, unknown>)?.[f.name])]),
      );
    }
    return out;
  });

  const [topicValues, setTopicValues] = useState<Record<string, Record<string, string>>>(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const topic of materialTopics) {
      const relation = TOPIC_RELATION[topic.code];
      const row = ((report as unknown as Record<string, unknown>)[relation] ?? {}) as GriTopicRow;
      out[topic.code] = Object.fromEntries(topic.fields.map((f) => [f.name, toStr(row[f.name])]));
    }
    return out;
  });

  const buildPayload = () => ({
    reportingPeriod,
    turnoverInr: turnoverInr || undefined,
    notes: notes || undefined,
    universal: Object.fromEntries(Object.entries(universal).map(([k, v]) => [k, v || undefined])),
    // Only material topics are sent. The backend rejects a payload for a
    // non-material topic outright, so filtering here is not the security
    // boundary — it just avoids a guaranteed 400 when a topic has been
    // de-materialised by a re-run assessment while this form was open.
    materialTopics: materialTopics.map((topic) => ({
      topicCode: topic.code,
      isMaterial: true,
      ...Object.fromEntries(
        GRI_3_3_FIELDS.map((f) => [f.name, managementApproach[topic.code]?.[f.name] || undefined]),
      ),
    })),
    topics: Object.fromEntries(
      materialTopics.map((topic) => [
        topic.code,
        Object.fromEntries(
          Object.entries(topicValues[topic.code] ?? {}).map(([k, v]) => [k, v || undefined]),
        ),
      ]),
    ),
  });

  const { status: autosaveStatus, triggerAutosave } = useAutosave(async () => {
    await griApi.save(facilityId, buildPayload(), false);
  });

  const onBlurAutosave = () => {
    if (!isAlreadySubmitted) triggerAutosave();
  };

  const onSubmit = async () => {
    setServerError(null);
    setSubmitting(true);
    try {
      await griApi.save(facilityId, buildPayload(), true);
      router.push(`/facilities/${facilityId}/gri/${encodeURIComponent(reportingPeriod)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (
    field: GriFormField,
    value: string,
    onChange: (v: string) => void,
    idPrefix: string,
  ) => {
    const id = `${idPrefix}-${field.name}`;
    return (
      <div key={id} className={field.type === "text" ? "sm:col-span-2" : undefined}>
        <Label htmlFor={id}>{field.label}</Label>
        {field.type === "text" ? (
          <textarea
            id={id}
            rows={3}
            className={textareaClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        ) : field.type === "bool" ? (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlurAutosave}>
            <option value="">Not disclosed</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        ) : (
          <Input
            id={id}
            inputMode={inputModeFor(field.type)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlurAutosave}
          />
        )}
        {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    );
  };

  const accordance = metrics?.accordance;

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
          This report has already been submitted. Changes here only save when you resubmit below.
        </Alert>
      )}

      {/* The claim status, stated plainly and continuously — an incomplete
          report must never be able to reach the PDF believing it can claim
          "in accordance". */}
      {accordance && (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            {accordance.inAccordance ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div className="min-w-0">
              <h2 className="font-medium">
                {accordance.inAccordance
                  ? "In accordance with the GRI Standards"
                  : "Currently: with reference to the GRI Standards"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {accordance.inAccordance
                  ? "All nine GRI 1 reporting requirements are met. The report will carry the full 'in accordance' claim."
                  : "GRI 1 allows the stronger 'in accordance' claim only once every requirement is met. Outstanding items:"}
              </p>
              {!accordance.inAccordance && (
                <ul className="mt-3 space-y-1.5">
                  {accordance.blockers.map((blocker, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-amber-500">•</span>
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {accordance.universalDisclosuresReported} of {accordance.universalDisclosuresTotal} GRI 2 disclosures
                reported · {accordance.materialTopicCount} material topics
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-medium">Reporting basis</h2>
        <div className="mt-4 max-w-sm">
          <Label htmlFor="turnoverInr">Turnover for the period (Rs.)</Label>
          <Input
            id="turnoverInr"
            inputMode="decimal"
            value={turnoverInr}
            onChange={(e) => setTurnoverInr(e.target.value)}
            onBlur={onBlurAutosave}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Denominator for the GRI 302-3 energy-intensity and GRI 305-4 emissions-intensity ratios.
          </p>
        </div>
      </Card>

      {/* --- GRI 2: always shown --- */}
      <div>
        <h2 className="text-lg font-semibold">GRI 2 — General Disclosures</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Always reported in full, regardless of materiality. Disclosure 2-27 covers compliance with laws and
          regulations — it replaced the withdrawn GRI 307 and GRI 419.
        </p>
      </div>

      {UNIVERSAL_GROUPS.map((group) => (
        <Card key={group.title} className="p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-medium">{group.title}</h3>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{group.caption}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((field) =>
              renderField(
                field,
                universal[field.name] ?? "",
                (v) => setUniversal((prev) => ({ ...prev, [field.name]: v })),
                "universal",
              ),
            )}
          </div>
        </Card>
      ))}

      {/* --- Topic Standards, gated by materiality --- */}
      <div>
        <h2 className="text-lg font-semibold">Topic Standards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown because your GRI 3 materiality assessment determined them material.{" "}
          <Link
            href={`/facilities/${facilityId}/gri/${encodeURIComponent(reportingPeriod)}/materiality`}
            className="font-medium text-teal-500 hover:underline"
          >
            Re-run the assessment
          </Link>{" "}
          to change which topics appear here.
        </p>
      </div>

      {materialTopics.map((topic) => {
        const completeness = accordance?.topics.find((t) => t.topicCode === topic.code);
        return (
          <Card key={topic.code} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">
                <span className="text-muted-foreground">{topic.label}</span> {topic.title}
              </h3>
              <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
                Material
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{topic.edition}</p>

            {/* GRI 3-3 is mandatory for every material topic — surfaced first,
                since an incomplete one blocks the "in accordance" claim. */}
            <div className="mt-5 rounded-xl border border-surface-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-medium">3-3 Management of material topics</h4>
                {completeness && !completeness.managementApproachComplete && (
                  <span className="text-[11px] font-medium text-amber-500">
                    {completeness.missingManagementApproachFields.length} of {GRI_3_3_FIELDS.length} outstanding
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-4">
                {GRI_3_3_FIELDS.map((field) => (
                  <div key={field.name}>
                    <Label htmlFor={`ma-${topic.code}-${field.name}`}>{field.label}</Label>
                    <textarea
                      id={`ma-${topic.code}-${field.name}`}
                      rows={2}
                      className={textareaClass}
                      placeholder={field.hint}
                      value={managementApproach[topic.code]?.[field.name] ?? ""}
                      onChange={(e) =>
                        setManagementApproach((prev) => ({
                          ...prev,
                          [topic.code]: { ...prev[topic.code], [field.name]: e.target.value },
                        }))
                      }
                      onBlur={onBlurAutosave}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {topic.fields.map((field) =>
                renderField(
                  field,
                  topicValues[topic.code]?.[field.name] ?? "",
                  (v) =>
                    setTopicValues((prev) => ({
                      ...prev,
                      [topic.code]: { ...prev[topic.code], [field.name]: v },
                    })),
                  topic.code,
                ),
              )}
            </div>
          </Card>
        );
      })}

      {/* Excluded topics are shown, not hidden — GRI requires the report to be
          explicit about what was assessed and excluded. */}
      {excludedTopics.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Not material for this facility</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            These Topic Standards were assessed and did not reach your disclosed materiality threshold. They are
            recorded in the GRI content index with the rationale below, rather than silently omitted.
          </p>
          <div className="mt-4 space-y-2">
            {excludedTopics.map((topic) => {
              const record = report.materialTopics.find((t) => t.topicCode === topic.code);
              return (
                <div key={topic.code} className="rounded-xl border border-surface-border px-4 py-3">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{topic.label}</span> {topic.title}
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
          placeholder="Anything an assurance provider or stakeholder should know about this report"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onBlurAutosave}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit} isLoading={submitting}>
          {isAlreadySubmitted ? "Resubmit GRI report" : "Submit GRI report"}
        </Button>
      </div>
    </div>
  );
}

/** Topic code to the GriReport relation carrying that topic's stored row. Mirrors the backend registry's `relation`. */
const TOPIC_RELATION: Record<string, string> = {
  GRI_301: "materialsDisclosure",
  GRI_302: "energyDisclosure",
  GRI_303: "waterDisclosure",
  GRI_101: "biodiversityDisclosure",
  GRI_305: "emissionsDisclosure",
  GRI_306: "wasteDisclosure",
  GRI_308: "supplierEnvDisclosure",
  GRI_401: "employmentDisclosure",
  GRI_403: "ohsDisclosure",
  GRI_404: "trainingDisclosure",
  GRI_405: "diversityDisclosure",
  GRI_406: "nonDiscriminationDisclosure",
  GRI_413: "localCommunitiesDisclosure",
  GRI_414: "supplierSocialDisclosure",
  GRI_416: "customerHsDisclosure",
  GRI_418: "customerPrivacyDisclosure",
};
