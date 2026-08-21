import { Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { EsgGriSummary } from "@/lib/types";

/**
 * GRI Standards 2021 summary across facilities.
 *
 * The thing this card must not do is report a company-level topic total.
 * Which Topic Standards a facility reports is decided by its own GRI 3
 * materiality assessment, so two facilities can both be fully compliant while
 * covering entirely different topics — a sum would be meaningless and an
 * average would imply the topics are interchangeable.
 *
 * So it shows the union and the intersection: how many distinct topics are
 * material somewhere, and how many are material everywhere. The per-topic
 * spread underneath carries the "N of M facilities" detail, which is the
 * genuinely useful signal for a multi-facility programme — a topic material at
 * every site is a company-level issue, one material at a single site is local.
 *
 * The "in accordance" count is shown as a fraction of reporting facilities and
 * never rounded up to a claim: GRI 1 permits the strong claim only when every
 * requirement is met, and a card that implied otherwise would be the same
 * false compliance signal the report itself is built to avoid.
 */

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function GriSummaryCard({ gri }: { gri: EsgGriSummary }) {
  const allInAccordance = gri.hasReports && gri.facilitiesInAccordance === gri.facilitiesReporting;
  const multiFacility = gri.facilitiesReporting > 1;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">GRI Standards 2021</h2>
        {gri.hasReports && gri.periodLabel && <p className="text-xs text-muted-foreground">{gri.periodLabel}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Materiality-driven disclosure across {gri.facilitiesReporting}{" "}
        {gri.facilitiesReporting === 1 ? "facility" : "facilities"} reporting.
      </p>

      {gri.hasReports ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric
              label="In accordance"
              value={`${gri.facilitiesInAccordance} of ${gri.facilitiesReporting}`}
              hint={
                allInAccordance
                  ? "Every reporting facility meets GRI 1 in full"
                  : "Others report with reference to the Standards"
              }
            />
            <Metric
              label="General disclosures"
              value={`${gri.universalDisclosuresReported} of ${gri.universalDisclosuresTotal}`}
              hint={multiFacility ? "GRI 2, at the least complete facility" : "GRI 2"}
            />
            <Metric
              label="Material topics"
              value={String(gri.distinctMaterialTopics)}
              hint={multiFacility ? "Distinct topics material at one or more facility" : "Topics determined material"}
            />
            {multiFacility && (
              <Metric
                label="Material everywhere"
                value={String(gri.topicsMaterialEverywhere)}
                hint="Topics material at every reporting facility"
              />
            )}
          </div>

          {gri.topicSpread.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-foreground">
                {multiFacility ? "Where each topic is material" : "Material topics"}
              </p>
              <div className="mt-2.5 space-y-1.5">
                {gri.topicSpread.map((topic) => (
                  <div
                    key={topic.topicCode}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2"
                  >
                    <p className="min-w-0 truncate text-xs text-foreground">
                      <span className="text-muted-foreground">{topic.label}</span> {topic.title}
                    </p>
                    {multiFacility && (
                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                        {topic.facilities} of {gri.facilitiesReporting}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {gri.outstandingRequirements.length > 0 && (
            <div className="mt-4 rounded-lg border border-surface-border bg-surface-raised/60 p-4">
              <p className="text-xs font-medium text-foreground">Outstanding for an in-accordance claim</p>
              <ul className="mt-2 space-y-1.5">
                {gri.outstandingRequirements.map((requirement, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                    <span className="text-[#F5A623]">•</span>
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={Globe2}
          title="No GRI report yet"
          description="Run a GRI 3 materiality assessment for a facility to see its material topics and content-index status rolled up here."
          ctaHref="/esg/gri"
          ctaLabel="Go to GRI"
        />
      )}
    </Card>
  );
}
