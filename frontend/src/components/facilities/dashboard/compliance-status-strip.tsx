import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { cn } from "@/lib/utils";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { UpsellCard } from "./upsell-card";
import { fmtEur, fmtIntensity, fmtTco2e } from "./dashboard-constants";
import type { DashboardAccess } from "./dashboard-access";
import type { FacilityDashboard, PlanDefinition, SubscriptionTier } from "@/lib/types";

const VALUE_PROPOSITIONS: Partial<Record<SubscriptionTier, string>> = {
  CBAM_COMPLIANCE: "Calculate EU CBAM certificate exposure automatically",
  CCTS_COMPLIANCE: "Track GHG intensity against BEE targets",
  BRSR_CORE_REPORTING: "Disclose the 9 SEBI BRSR Core ESG attributes",
};

const planUpsell = (plans: PlanDefinition[], tier: SubscriptionTier) => {
  const plan = plans.find((p) => p.tier === tier);
  return plan ? { title: plan.name, priceLabel: plan.priceLabel, valueProposition: VALUE_PROPOSITIONS[tier]! } : null;
};

type BadgeTone = "green" | "amber" | "red" | "grey";

const BADGE_STYLES: Record<BadgeTone, string> = {
  green: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  amber: "border-warning/30 bg-warning/10 text-warning",
  red: "border-danger/30 bg-danger/10 text-danger",
  grey: "border-surface-border bg-surface-raised text-muted-foreground",
};

function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", BADGE_STYLES[tone])}>
      {children}
    </span>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-6">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="mt-3 flex-1">{children}</div>
    </Card>
  );
}

export function ComplianceStatusStrip({
  dashboard,
  facilityId,
  access,
  plans,
}: {
  dashboard: FacilityDashboard;
  facilityId: string;
  access: DashboardAccess;
  plans: PlanDefinition[];
}) {
  const { cbam, ccts, brsr } = dashboard;
  const addDataHref = `/facilities/${facilityId}/data-entry/new`;
  const brsrHref = `/facilities/${facilityId}/brsr/new`;

  const cbamUpsell = planUpsell(plans, "CBAM_COMPLIANCE");
  const cctsUpsell = planUpsell(plans, "CCTS_COMPLIANCE");
  const brsrUpsell = planUpsell(plans, "BRSR_CORE_REPORTING");

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {/* Card 1 — CBAM */}
      {!access.hasCbam && cbamUpsell ? (
        <UpsellCard {...cbamUpsell} />
      ) : (
        <StatCard title="CBAM">
          {cbam.hasData ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={cbam.isBetterThanDefault ? "green" : "red"}>
                  {cbam.isBetterThanDefault ? "Savings confirmed" : "Certificate exposure"}
                </StatusBadge>
                {cbam.evidencePending && <EvidencePendingBadge />}
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {fmtIntensity(cbam.actualSee!)} <span className="text-sm font-normal text-muted-foreground">{cbam.seeUnit}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                vs. EU default {fmtIntensity(cbam.defaultSee!)} {cbam.seeUnit}
              </p>
              <p className="mt-4 border-t border-surface-border pt-3 text-xs text-muted-foreground">
                Estimated liability ({cbam.certificatePriceQuarter})
              </p>
              <p className="mt-0.5 text-lg font-semibold text-foreground">{fmtEur(cbam.liabilityEur!)}</p>
              <p className="mt-2 text-[11px] text-muted">{cbam.periodLabel}</p>
            </>
          ) : (
            <DashboardEmptyState
              icon={ClipboardList}
              title="No CBAM data yet"
              description="Submit activity data for a reporting period to see your CBAM position."
              ctaHref={addDataHref}
              ctaLabel="Add data entry"
            />
          )}
        </StatCard>
      )}

      {/* Card 2 — CCTS */}
      {!access.hasCcts && cctsUpsell ? (
        <UpsellCard {...cctsUpsell} />
      ) : (
        <StatCard title="CCTS">
          {ccts.hasData ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={ccts.tone === "SURPLUS" ? "green" : ccts.tone === "ON_TRACK" ? "amber" : ccts.tone === "DEFICIT" ? "red" : "grey"}>
                  {ccts.tone === "SURPLUS" ? "CCC Surplus" : ccts.tone === "ON_TRACK" ? "On Track" : ccts.tone === "DEFICIT" ? "Deficit" : "Target not notified"}
                </StatusBadge>
                {ccts.evidencePending && <EvidencePendingBadge />}
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {fmtIntensity(ccts.actualIntensity!)} <span className="text-sm font-normal text-muted-foreground">tCO2e/t</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ccts.targetIntensity != null ? `vs. notified target ${fmtIntensity(ccts.targetIntensity)} tCO2e/t` : "No BEE-notified target on file"}
              </p>
              {ccts.deltaTco2e != null && (
                <>
                  <p className="mt-4 border-t border-surface-border pt-3 text-xs text-muted-foreground">
                    {ccts.deltaTco2e >= 0 ? "CCC surplus" : "CCC deficit"}
                  </p>
                  <p className={cn("mt-0.5 text-lg font-semibold", ccts.deltaTco2e >= 0 ? "text-teal-500" : "text-danger")}>
                    {fmtTco2e(Math.abs(ccts.deltaTco2e))}
                  </p>
                </>
              )}
              <p className="mt-2 text-[11px] text-muted">{ccts.periodLabel}</p>
            </>
          ) : (
            <DashboardEmptyState
              icon={ClipboardList}
              title="No CCTS data yet"
              description="Submit activity data for a reporting period to see your CCTS position."
              ctaHref={addDataHref}
              ctaLabel="Add data entry"
            />
          )}
        </StatCard>
      )}

      {/* Card 3 — BRSR */}
      {!access.hasBrsr && brsrUpsell ? (
        <UpsellCard {...brsrUpsell} />
      ) : (
        <StatCard title="BRSR Core">
          <StatusBadge tone={brsr.status === "SUBMITTED" ? "green" : brsr.status === "DRAFT" ? "amber" : "grey"}>
            {brsr.status === "SUBMITTED" ? "Submitted" : brsr.status === "DRAFT" ? "Draft in progress" : "Not started"}
          </StatusBadge>
          <p className="mt-3 text-2xl font-semibold text-foreground">
            {brsr.attributesFilled} <span className="text-sm font-normal text-muted-foreground">of {brsr.attributesTotal} attributes</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{brsr.fyLabel}</p>
          {brsr.status === "NOT_STARTED" && (
            <div className="mt-4 border-t border-surface-border pt-3">
              <DashboardEmptyState
                icon={ClipboardList}
                title="Not started"
                description="Disclose the 9 BRSR Core ESG attributes for this financial year."
                ctaHref={brsrHref}
                ctaLabel="Start disclosure"
              />
            </div>
          )}
        </StatCard>
      )}
    </div>
  );
}
